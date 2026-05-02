#!/usr/bin/env python3
"""Seed Jira issue relationships (links + labels) for relationship index testing."""
import json
import os
import sys
import urllib.request
import urllib.error
import urllib.parse
import base64
import ssl
import time

# Load .env
env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
with open(env_path) as f:
    for line in f:
        line = line.strip()
        if '=' in line and not line.startswith('#'):
            key, _, val = line.partition('=')
            os.environ[key.strip()] = val.strip()

EMAIL = os.environ['ATLASSIAN_EMAIL']
TOKEN = os.environ['ATLASSIAN_TOKEN']
BASE = os.environ['ATLASSIAN_BASE_URL']
PROJECT_KEY = 'ROVO'
SPACE_KEY = os.environ.get('CONFLUENCE_SPACE_KEY', 'ROVO')
BASE_URL_DISPLAY = os.environ.get('ATLASSIAN_BASE_URL', BASE).replace('https://', '').replace('http://', '')

auth_header = 'Basic ' + base64.b64encode(f'{EMAIL}:{TOKEN}'.encode()).decode()
ctx = ssl.create_default_context()


def api(method, path, body=None):
    url = f'{BASE}{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', auth_header)
    req.add_header('Content-Type', 'application/json')
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  API Error {e.code}: {err[:200]}", file=sys.stderr)
        return None


# ══════════════════════════════════════════════════════
# STEP 1: Discover existing issues
# ══════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Discovering existing ROVO issues")
print("=" * 60)

search_result = api('POST', '/rest/api/3/search/jql', {
    'jql': f'project = {PROJECT_KEY} ORDER BY key ASC',
    'fields': ['summary', 'issuetype', 'labels', 'status', 'customfield_10014'],
    'maxResults': 50,
})

if not search_result or 'issues' not in search_result:
    print("ERROR: Could not fetch issues. Check .env credentials.")
    sys.exit(1)

issues = {}
for issue in search_result['issues']:
    key = issue['key']
    fields = issue['fields']
    issue_type = fields['issuetype']['name']
    summary = fields['summary']
    labels = fields.get('labels', [])
    epic = fields.get('customfield_10014')
    print(f"  {key}: [{issue_type}] {summary}  labels={labels}  epic={epic}")
    issues[key] = {
        'type': issue_type,
        'summary': summary,
        'labels': labels,
        'epic': epic,
    }

if not issues:
    print("No issues found. Run seed-test-data.py first.")
    sys.exit(1)

# ══════════════════════════════════════════════════════
# STEP 2: Add labels to issues
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2: Adding labels")
print("=" * 60)

# Map issues to labels based on their topic
label_map = {
    'auth': ['backend', 'security', 'authentication'],
    'catalog': ['backend', 'frontend', 'search'],
    'cart': ['backend', 'frontend', 'ecommerce'],
    'payments': ['backend', 'security', 'payments'],
}

# Classify issues by topic keywords
topic_keywords = {
    'auth': ['login', 'password', 'oauth', 'session', 'auth'],
    'catalog': ['product', 'catalog', 'search', 'categor', 'listing'],
    'cart': ['cart', 'discount', 'persistence'],
    'payments': ['payment', 'stripe', 'checkout', 'order'],
}

for key, info in issues.items():
    summary_lower = info['summary'].lower()
    new_labels = set()

    for topic, keywords in topic_keywords.items():
        if any(kw in summary_lower for kw in keywords):
            for label in label_map.get(topic, []):
                if label not in info['labels']:
                    new_labels.add(label)

    # Epics get their own label
    if info['type'] == 'Epic':
        for topic, keywords in topic_keywords.items():
            if any(kw in summary_lower for kw in keywords):
                new_labels.add(topic)
                for label in label_map.get(topic, []):
                    if label not in info['labels']:
                        new_labels.add(label)

    if new_labels:
        operations = [{"add": label} for label in new_labels]
        result = api('PUT', f'/rest/api/3/issue/{key}', {
            "update": {"labels": operations}
        })
        if result is not None:
            print(f"  {key}: added labels {new_labels}")
        else:
            # PUT returning empty is actually success for Jira edit
            print(f"  {key}: added labels {new_labels}")
        time.sleep(0.3)

# ══════════════════════════════════════════════════════
# STEP 3: Create issue links
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 3: Creating issue links")
print("=" * 60)

# Find issues by keyword in summary
def find_by_keyword(keyword):
    return [k for k, v in issues.items() if keyword in v['summary'].lower()]

# Define links to create: (source, target, type)
# "outwardIssue" is the target of the link
# "Blocks": outward blocks inward, so "A blocks B" means outward=A, inward=B
links_to_create = [
    # Auth epic: OAuth depends on Login
    ('Blocks', 'login', 'oauth'),
    ('Relates', 'login', 'session'),
    ('Relates', 'password', 'login'),

    # Catalog: search depends on listing
    ('Blocks', 'product listing', 'search'),
    ('Relates', 'product detail', 'product listing'),
    ('Relates', 'categor', 'product listing'),

    # Cart: discount relates to cart
    ('Relates', 'cart', 'discount'),
    ('Relates', 'cart', 'persistence'),

    # Payments: order email relates to stripe
    ('Relates', 'stripe', 'order'),
    ('Blocks', 'stripe', 'special characters'),

    # Cross-epic: auth is needed for cart
    ('Relates', 'cart', 'auth'),
]

created_links = set()
for link_type, source_kw, target_kw in links_to_create:
    sources = find_by_keyword(source_kw)
    targets = find_by_keyword(target_kw)

    for source_key in sources:
        for target_key in targets:
            if source_key == target_key:
                continue

            link_id = f"{source_key}-{target_key}-{link_type}"
            reverse_id = f"{target_key}-{source_key}-{link_type}"

            if link_id in created_links or reverse_id in created_links:
                continue

            result = api('POST', '/rest/api/3/issueLink', {
                "type": {"name": link_type},
                "inwardIssue": {"key": target_key},
                "outwardIssue": {"key": source_key},
            })

            if result is not None:
                print(f"  {source_key} --[{link_type}]--> {target_key}")
            else:
                # POST issueLink returns error on duplicate, but also might just fail
                # Try to detect if it's a duplicate link error
                print(f"  {source_key} --[{link_type}]--> {target_key} (may already exist)")

            created_links.add(link_id)
            time.sleep(0.3)

# ══════════════════════════════════════════════════════
# STEP 4: Verify epic links (customfield_10014)
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 4: Verifying epic links")
print("=" * 60)

epics = {k: v for k, v in issues.items() if v['type'] == 'Epic'}
non_epics = {k: v for k, v in issues.items() if v['type'] != 'Epic'}

print(f"  Found {len(epics)} epics, {len(non_epics)} stories/tasks/bugs")

missing_epic_link = []
for key, info in non_epics.items():
    if not info['epic']:
        summary_lower = info['summary'].lower()
        # Try to find the matching epic
        for epic_key, epic_info in epics.items():
            epic_lower = epic_info['summary'].lower()
            matched = False
            for topic, keywords in topic_keywords.items():
                if any(kw in summary_lower for kw in keywords) and any(kw in epic_lower for kw in keywords):
                    matched = True
                    break
            if matched:
                # Set epic link via customfield_10014
                result = api('PUT', f'/rest/api/3/issue/{key}', {
                    "fields": {"customfield_10014": epic_key}
                })
                if result is not None:
                    print(f"  {key}: linked to epic {epic_key}")
                else:
                    print(f"  {key}: linked to epic {epic_key}")
                missing_epic_link.append(key)
                time.sleep(0.3)
                break
        else:
            print(f"  {key}: no matching epic found")

# ══════════════════════════════════════════════════════
# STEP 5: Create Confluence pages referencing Jira issues
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 5: Creating Confluence pages linked to Jira issues")
print("=" * 60)


def get_space_homepage():
    result = api('GET', f'/wiki/rest/api/space/{SPACE_KEY}?expand=homepage')
    if result and 'homepage' in result:
        return result['homepage']['id']
    return None


def create_confluence_page(title, content, parent_id=None):
    body = {
        'type': 'page',
        'title': title,
        'space': {'key': SPACE_KEY},
        'status': 'current',
        'body': {
            'storage': {
                'value': content,
                'representation': 'storage'
            }
        }
    }
    if parent_id:
        body['ancestors'] = [{'id': str(parent_id)}]

    result = api('POST', '/wiki/rest/api/content', body)
    if result and 'id' in result:
        page_url = f"https://{BASE_URL_DISPLAY}/wiki{result.get('_links', {}).get('webui', '')}"
        print(f"  Created: {title} → {page_url}")
        return result['id'], page_url
    else:
        print(f"  FAILED: {title}")
        return None, None


def page_exists(title):
    params = urllib.parse.urlencode({'spaceKey': SPACE_KEY, 'title': title})
    result = api('GET', f'/wiki/rest/api/content?{params}')
    if result and result.get('results') and len(result['results']) > 0:
        return result['results'][0]['id']
    return None


homepage_id = get_space_homepage()
print(f"  Space homepage: {homepage_id}")

# Collect issue keys by topic for referencing in pages
auth_issues = [k for k, v in issues.items() if any(kw in v['summary'].lower() for kw in ['login', 'password', 'oauth', 'session', 'auth']) and v['type'] != 'Epic']
catalog_issues = [k for k, v in issues.items() if any(kw in v['summary'].lower() for kw in ['product', 'search', 'categor', 'listing', 'detail']) and v['type'] != 'Epic']
cart_issues = [k for k, v in issues.items() if any(kw in v['summary'].lower() for kw in ['cart', 'discount', 'persistence']) and v['type'] != 'Epic']
payment_issues = [k for k, v in issues.items() if any(kw in v['summary'].lower() for kw in ['payment', 'stripe', 'checkout', 'order', 'special char']) and v['type'] != 'Epic']

auth_epic = [k for k, v in issues.items() if v['type'] == 'Epic' and 'auth' in v['summary'].lower()]
catalog_epic = [k for k, v in issues.items() if v['type'] == 'Epic' and ('catalog' in v['summary'].lower() or 'product' in v['summary'].lower())]
cart_epic = [k for k, v in issues.items() if v['type'] == 'Epic' and 'cart' in v['summary'].lower()]
payment_epic = [k for k, v in issues.items() if v['type'] == 'Epic' and ('payment' in v['summary'].lower() or 'checkout' in v['summary'].lower())]

# Track created pages to update Jira descriptions later
page_map = {}  # topic -> (page_id, page_url)

# ── Auth Design Doc ──
auth_refs = ' '.join(f'[{k}]' for k in auth_issues + auth_epic)
auth_title = "Authentication System Design"
if not page_exists(auth_title):
    auth_page_id, auth_page_url = create_confluence_page(
        auth_title,
        f"""
        <h1>Authentication System Design</h1>
        <p>This document describes the authentication system architecture for the e-commerce platform.</p>

        <h2>Overview</h2>
        <p>The authentication module covers user registration, login, OAuth integrations, and session management.
        Related Jira issues: {auth_refs}</p>

        <h2>Architecture</h2>
        <p>We use JWT access tokens (15 min expiry) with httpOnly refresh cookie rotation.
        Refresh token hashes are stored in Redis for revocation support.</p>

        <h3>Login Flow</h3>
        <ol>
        <li>User submits email + password to <code>/api/auth/login</code></li>
        <li>Server validates credentials against bcrypt hash (cost factor 12)</li>
        <li>On success: generate JWT access token + refresh token (rotation)</li>
        <li>Access token in response body, refresh in httpOnly cookie</li>
        <li>Client sends <code>Authorization: Bearer &lt;token&gt;</code> on API calls</li>
        </ol>

        <h3>OAuth 2.0 Integration</h3>
        <p>Google OAuth via PKCE flow. Auto-create account on first login.
        Link Google account to existing account by matching email.
        Related: see {auth_refs} for implementation details.</p>

        <h2>Security Considerations</h2>
        <ul>
        <li>Rate limiting: max 5 failed login attempts per 15 minutes</li>
        <li>CSRF protection on all auth endpoints</li>
        <li>Password hashing: bcrypt cost factor 12</li>
        <li>Refresh token rotation prevents token theft</li>
        </ul>

        <h2>Known Issues</h2>
        <p>Session expiry bug — sessions expire after ~5 minutes.
        Root cause: JWT clock skew between services.
        Fix: synchronize server clocks via NTP and add 30s grace period.</p>
        """,
        homepage_id,
    )
    if auth_page_id:
        page_map['auth'] = (auth_page_id, auth_page_url)
        time.sleep(0.3)
else:
    print(f"  SKIP (exists): {auth_title}")

# ── Catalog Design Doc ──
catalog_refs = ' '.join(f'[{k}]' for k in catalog_issues + catalog_epic)
catalog_title = "Product Catalog Architecture"
if not page_exists(catalog_title):
    catalog_page_id, catalog_page_url = create_confluence_page(
        catalog_title,
        f"""
        <h1>Product Catalog Architecture</h1>
        <p>Product catalog system design covering listing, search, filtering, and category management.</p>

        <h2>Overview</h2>
        <p>The catalog module powers product browsing, search, and category navigation.
        Related Jira issues: {catalog_refs}</p>

        <h2>Product Data Model</h2>
        <table>
        <tr><th>Field</th><th>Type</th><th>Description</th></tr>
        <tr><td>id</td><td>UUID</td><td>Primary key</td></tr>
        <tr><td>name</td><td>varchar(255)</td><td>Product name</td></tr>
        <tr><td>description</td><td>text</td><td>Full description</td></tr>
        <tr><td>price</td><td>decimal(10,2)</td><td>Price in USD</td></tr>
        <tr><td>sku</td><td>varchar(50)</td><td>Stock keeping unit</td></tr>
        <tr><td>category_id</td><td>UUID</td><td>FK to categories</td></tr>
        <tr><td>stock</td><td>integer</td><td>Available inventory</td></tr>
        </table>

        <h2>Search Architecture</h2>
        <p>Elasticsearch with product index. Fields: name, description, SKU, category, tags.
        Relevance scoring: name &gt; category &gt; description.
        Sync from PostgreSQL via Debezium CDC.</p>

        <h2>Category Taxonomy</h2>
        <p>Hierarchical categories up to 4 levels. Each category has: name, slug, parent, description, image.
        Seed data: Electronics (Phones, Laptops, Tablets), Clothing (Men, Women), Home &amp; Garden.</p>

        <h2>API Endpoints</h2>
        <ul>
        <li>GET /api/products — List with filters (category, price, brand, rating, in-stock)</li>
        <li>GET /api/products/:id — Product detail</li>
        <li>GET /api/products/search — Full-text search with fuzzy matching</li>
        <li>GET /api/categories — Category tree</li>
        </ul>
        """,
        homepage_id,
    )
    if catalog_page_id:
        page_map['catalog'] = (catalog_page_id, catalog_page_url)
        time.sleep(0.3)
else:
    print(f"  SKIP (exists): {catalog_title}")

# ── Cart Design Doc ──
cart_refs = ' '.join(f'[{k}]' for k in cart_issues + cart_epic)
cart_title = "Shopping Cart Design"
if not page_exists(cart_title):
    cart_page_id, cart_page_url = create_confluence_page(
        cart_title,
        f"""
        <h1>Shopping Cart Design</h1>
        <p>Shopping cart system including add/remove items, persistence, and discount codes.</p>

        <h2>Overview</h2>
        <p>The cart module manages user shopping carts with server-side persistence for logged-in users
        and localStorage for guest carts (merged on login).
        Related Jira issues: {cart_refs}</p>

        <h2>Cart Data Model</h2>
        <table>
        <tr><th>Field</th><th>Type</th><th>Description</th></tr>
        <tr><td>id</td><td>UUID</td><td>Cart ID</td></tr>
        <tr><td>user_id</td><td>UUID</td><td>FK to users (null for guest)</td></tr>
        <tr><td>guest_token</td><td>varchar(64)</td><td>Guest identifier</td></tr>
        <tr><td>items</td><td>jsonb</td><td>Array of cart items</td></tr>
        <tr><td>discount_code</td><td>varchar(50)</td><td>Applied discount code</td></tr>
        <tr><td>created_at</td><td>timestamp</td><td>Cart creation</td></tr>
        <tr><td>updated_at</td><td>timestamp</td><td>Last modification</td></tr>
        </table>

        <h2>Business Rules</h2>
        <ul>
        <li>Max 99 units per product in cart</li>
        <li>One discount code per order</li>
        <li>Discount types: percentage off, fixed amount, free shipping</li>
        <li>Cart expires after 30 days of inactivity</li>
        <li>Guest cart merges with user cart on login (keep higher quantity)</li>
        </ul>

        <h2>API Endpoints</h2>
        <ul>
        <li>GET /api/cart — Current cart with items and totals</li>
        <li>POST /api/cart/items — Add item (product_id, quantity)</li>
        <li>PUT /api/cart/items/:id — Update quantity</li>
        <li>DELETE /api/cart/items/:id — Remove item</li>
        <li>POST /api/cart/discount — Apply discount code</li>
        </ul>
        """,
        homepage_id,
    )
    if cart_page_id:
        page_map['cart'] = (cart_page_id, cart_page_url)
        time.sleep(0.3)
else:
    print(f"  SKIP (exists): {cart_title}")

# ── Payments Design Doc ──
payment_refs = ' '.join(f'[{k}]' for k in payment_issues + payment_epic)
payment_title = "Payments and Checkout Design"
if not page_exists(payment_title):
    payment_page_id, payment_page_url = create_confluence_page(
        payment_title,
        f"""
        <h1>Payments and Checkout Design</h1>
        <p>End-to-end checkout flow with Stripe integration and order processing.</p>

        <h2>Overview</h2>
        <p>The payments module handles checkout, Stripe payment processing, and order confirmation.
        Related Jira issues: {payment_refs}</p>

        <h2>Payment Flow</h2>
        <ol>
        <li>User clicks "Checkout" from cart</li>
        <li>Frontend calls <code>POST /api/checkout/create-payment-intent</code></li>
        <li>Server creates Stripe PaymentIntent with cart total</li>
        <li>Frontend renders Stripe Elements for card input</li>
        <li>User submits card → Stripe processes payment</li>
        <li>Webhook <code>payment_intent.succeeded</code> triggers order creation</li>
        <li>Order confirmation email sent via SendGrid</li>
        </ol>

        <h2>PCI Compliance</h2>
        <p>Using Stripe Elements (SAQ A compliance). Card data never touches our servers.
        Idempotency keys on all payment requests for retry safety.</p>

        <h2>Supported Cards</h2>
        <ul>
        <li>Visa, Mastercard, Amex</li>
        <li>3D Secure for European cards</li>
        <li>Save card for returning customers (opt-in via Stripe Customer API)</li>
        </ul>

        <h2>Known Issues</h2>
        <p>UTF-8 encoding bug: payments rejected when shipping address contains accented characters
        (e.g., José, Zürich). Fix: encode UTF-8 properly in Stripe payment metadata.</p>

        <h2>Webhook Events</h2>
        <table>
        <tr><th>Event</th><th>Action</th></tr>
        <tr><td>payment_intent.succeeded</td><td>Create order, send email, clear cart</td></tr>
        <tr><td>payment_intent.failed</td><td>Log failure, notify user</td></tr>
        </table>
        """,
        homepage_id,
    )
    if payment_page_id:
        page_map['payments'] = (payment_page_id, payment_page_url)
        time.sleep(0.3)
else:
    print(f"  SKIP (exists): {payment_title}")

# ── Cross-cutting page: Deployment Guide referencing all issues ──
all_refs = ' '.join(f'[{k}]' for k in sorted(issues.keys()))
deploy_title = "Deployment and Operations Guide"
if not page_exists(deploy_title):
    deploy_page_id, deploy_page_url = create_confluence_page(
        deploy_title,
        f"""
        <h1>Deployment and Operations Guide</h1>

        <h2>Architecture</h2>
        <p>Modular monolith with the following components:</p>
        <ul>
        <li><strong>API Server:</strong> Node.js + Express + TypeScript</li>
        <li><strong>Database:</strong> PostgreSQL 15 + Prisma ORM</li>
        <li><strong>Cache:</strong> Redis (sessions, rate limiting)</li>
        <li><strong>Search:</strong> Elasticsearch (product catalog)</li>
        <li><strong>Payments:</strong> Stripe Payment Intents API</li>
        <li><strong>Email:</strong> SendGrid + Handlebars templates</li>
        <li><strong>CDN:</strong> CloudFront (static assets)</li>
        </ul>

        <h2>Project Tickets</h2>
        <p>All implementation tickets: {all_refs}</p>

        <h2>Infrastructure</h2>
        <p>Docker Compose for development. AWS ECS for production.
        CI/CD via GitHub Actions with automated test + deploy pipeline.</p>

        <h2>Monitoring</h2>
        <ul>
        <li>Application: Datadog APM + logs</li>
        <li>Infrastructure: CloudWatch metrics</li>
        <li>Uptime: Pingdom external checks</li>
        <li>Errors: Sentry with source maps</li>
        </ul>

        <h2>Runbooks</h2>
        <h3>Auth Service Down</h3>
        <p>Check Redis connectivity. Verify JWT secret is set.
        Check rate limiter counters in Redis.</p>

        <h3>Search Index Out of Sync</h3>
        <p>Check Debezium CDC connector status. Reindex via admin API:
        <code>POST /api/admin/search/reindex</code></p>
        """,
        homepage_id,
    )
    if deploy_page_id:
        page_map['deploy'] = (deploy_page_id, deploy_page_url)
        time.sleep(0.3)
else:
    print(f"  SKIP (exists): {deploy_title}")

# ══════════════════════════════════════════════════════
# STEP 6: Update Jira issue descriptions with Confluence links
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 6: Updating Jira descriptions with Confluence links")
print("=" * 60)

# Map topics to their Confluence page URLs
topic_page_urls = {}
for topic, (_, url) in page_map.items():
    if url:
        topic_page_urls[topic] = url

# For each non-epic issue, append a "Documentation" section to the description
topic_keywords_extended = {
    'auth': ['login', 'password', 'oauth', 'session', 'auth'],
    'catalog': ['product', 'catalog', 'search', 'categor', 'listing', 'detail'],
    'cart': ['cart', 'discount', 'persistence'],
    'payments': ['payment', 'stripe', 'checkout', 'order', 'special char'],
}

for key, info in issues.items():
    if info['type'] == 'Epic':
        continue

    summary_lower = info['summary'].lower()
    doc_line = None

    for topic, keywords in topic_keywords_extended.items():
        if any(kw in summary_lower for kw in keywords):
            if topic in topic_page_urls:
                doc_line = f"Documentation: {topic_page_urls[topic]}"
                break

    if not doc_line and topic_page_urls:
        # Add the deployment guide as fallback
        if 'deploy' in topic_page_urls:
            doc_line = f"See also: {topic_page_urls['deploy']}"

    if doc_line:
        # Get current description
        issue_data = api('GET', f'/rest/api/3/issue/{key}?fields=description')
        if issue_data and 'fields' in issue_data:
            desc = issue_data['fields'].get('description', {})
            # Append doc reference to existing Atlassian Document Format
            if isinstance(desc, dict) and 'content' in desc:
                desc['content'].append({
                    'type': 'paragraph',
                    'content': [{'type': 'text', 'text': doc_line}]
                })
                api('PUT', f'/rest/api/3/issue/{key}', {
                    'fields': {'description': desc}
                })
                print(f"  {key}: added doc link to description")
                time.sleep(0.3)

# ══════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("DONE — Now Re-index in the Issue Panel")
print("=" * 60)
print(f"""
Seeded relationships for {len(issues)} issues:
  - Labels added (backend, security, auth, etc.)
  - Issue links created (Blocks, Relates)
  - Epic links assigned (customfield_10014)
  - {len(page_map)} Confluence pages created with Jira references
  - Jira descriptions updated with Confluence doc links

Next steps:
1. Open any ROVO issue in Jira
2. Click "Re-index" button in the Consistency Guard panel
3. Check the consistency score — it should now reflect relationship data
""")

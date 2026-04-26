#!/usr/bin/env python3
"""Seed Jira + Confluence with test data for Rovo Execution Guard testing."""
import json
import os
import sys
import urllib.request
import urllib.error
import base64
import ssl

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
PROJECT_ID = '10033'
PROJECT_KEY = 'ROVO'
SPACE_KEY = os.environ.get('CONFLUENCE_SPACE_KEY', 'ROVO')

auth_header = 'Basic ' + base64.b64encode(f'{EMAIL}:{TOKEN}'.encode()).decode()


def api(method, path, body=None):
    """Make an authenticated Jira/Confluence API call."""
    url = f'{BASE}{path}'
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header('Authorization', auth_header)
    req.add_header('Content-Type', 'application/json')
    ctx = ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx) as resp:
            raw = resp.read().decode()
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        err = e.read().decode()
        print(f"  API Error {e.code}: {err[:200]}", file=sys.stderr)
        return None


def create_issue(summary, description, issuetype_id, parent_key=None):
    """Create a Jira issue and return its key."""
    fields = {
        'project': {'id': PROJECT_ID},
        'summary': summary,
        'description': {
            'type': 'doc',
            'version': 1,
            'content': [{
                'type': 'paragraph',
                'content': [{'type': 'text', 'text': description}]
            }]
        },
        'issuetype': {'id': issuetype_id},
    }
    if parent_key:
        fields['parent'] = {'key': parent_key}

    result = api('POST', '/rest/api/3/issue', {'fields': fields})
    if result and 'key' in result:
        print(f"  Created {result['key']}: {summary}")
        return result['key']
    else:
        print(f"  FAILED: {summary}")
        return None


def create_confluence_page(title, content, parent_id=None):
    """Create a Confluence page and return its ID."""
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
        print(f"  Created page: {title} (id: {result['id']})")
        return result['id']
    else:
        print(f"  FAILED page: {title}")
        return None


def get_homepage_id():
    """Get the Confluence space homepage ID."""
    result = api('GET', f'/wiki/rest/api/space/{SPACE_KEY}?expand=homepage')
    if result and 'homepage' in result:
        return result['homepage']['id']
    return None


# ── Issue type IDs from the project ──
EPIC = '10039'
STORY = '10038'
TASK = '10036'
BUG = '10037'

# ══════════════════════════════════════════════════════
# STEP 1: Create Jira Epics & Issues
# ══════════════════════════════════════════════════════
print("=" * 60)
print("STEP 1: Creating Jira Epics & Issues")
print("=" * 60)

epics = {}

# ── Epic 1: User Authentication ──
print("\n--- Epic 1: User Authentication ---")
epic1 = create_issue(
    "Epic: User Authentication",
    "Complete authentication system for the e-commerce platform including login, registration, password management, and OAuth integrations. This covers the full user identity lifecycle from account creation to session management.",
    EPIC
)
epics['auth'] = epic1

# Stories under Epic 1 (mix of rich and poor descriptions)
if epic1:
    create_issue(
        "Login with email and password",
        "As a registered user, I want to log in with my email and password so that I can access my account.\n\n"
        "Acceptance Criteria:\n"
        "- Login form with email and password fields\n"
        "- Form validation: required fields, email format, min 8 chars password\n"
        "- Display error message for invalid credentials\n"
        "- On success: redirect to dashboard, store JWT in httpOnly cookie\n"
        "- Rate limit: max 5 failed attempts per 15 minutes\n"
        "- 'Remember me' checkbox for 30-day sessions\n\n"
        "Technical Notes:\n"
        "- Use bcrypt for password hashing (cost factor 12)\n"
        "- JWT with 15-min access token + refresh token rotation\n"
        "- CSRF protection on login endpoint",
        STORY, epic1
    )

    create_issue(
        "Password reset flow",
        "Users can reset their password via email link.",
        STORY, epic1
    )

    create_issue(
        "OAuth integration (Google)",
        "As a user, I want to sign in with my Google account so I don't need to create a new account.\n\n"
        "Acceptance Criteria:\n"
        "- 'Sign in with Google' button on login page\n"
        "- OAuth 2.0 flow with PKCE\n"
        "- Auto-create account on first Google login\n"
        "- Link Google account to existing account (same email)\n"
        "- Handle Google API errors gracefully\n\n"
        "Technical Notes:\n"
        "- Use Google Identity Services library\n"
        "- Store Google subject ID in users table\n"
        "- IdP-initiated SSO not in scope",
        STORY, epic1
    )

    create_issue(
        "Session expires unexpectedly",
        "Bug: User sessions expire after ~5 minutes even with activity. Expected: sessions should last 24 hours with inactivity timeout.",
        BUG, epic1
    )

# ── Epic 2: Product Catalog ──
print("\n--- Epic 2: Product Catalog ---")
epic2 = create_issue(
    "Epic: Product Catalog",
    "Product catalog with listing, search, filtering, and detail pages. Includes category management and product data model.",
    EPIC
)
epics['catalog'] = epic2

if epic2:
    create_issue(
        "Product listing page with filters",
        "As a shopper, I want to browse products with filters so I can find what I need quickly.\n\n"
        "Acceptance Criteria:\n"
        "- Grid/list view toggle\n"
        "- Filters: category, price range, brand, rating, in-stock\n"
        "- Sort by: relevance, price (asc/desc), rating, newest\n"
        "- Pagination: 24 items per page\n"
        "- URL-driven filters for bookmarking/sharing\n"
        "- Skeleton loading states\n"
        "- Responsive: 4 cols desktop, 2 cols tablet, 1 col mobile",
        STORY, epic2
    )

    create_issue(
        "Product detail page",
        "Show product details.",
        STORY, epic2
    )

    create_issue(
        "Search functionality",
        "As a shopper, I want to search products by keyword so I can find specific items.\n\n"
        "Acceptance Criteria:\n"
        "- Search bar in header, auto-focus with '/' keyboard shortcut\n"
        "- Real-time suggestions after 3 characters (debounced 300ms)\n"
        "- Support: exact match, fuzzy match, typo correction\n"
        "- Highlight matching terms in results\n"
        "- 'No results' state with suggestions\n"
        "- Search history (last 10 queries, stored locally)\n\n"
        "Technical Notes:\n"
        "- Use Elasticsearch with product index\n"
        "- Index: name, description, SKU, category, tags\n"
        "- Relevance scoring boost: name > category > description",
        STORY, epic2
    )

    create_issue(
        "Add product categories taxonomy",
        "Create a hierarchical product category taxonomy with support for multi-level nesting (max 4 levels). "
        "Categories have: name, slug, parent, description, image. Admin UI for managing categories. "
        "Seed with Electronics > Phones, Laptops, Tablets; Clothing > Men, Women; Home & Garden.",
        TASK, epic2
    )

# ── Epic 3: Shopping Cart ──
print("\n--- Epic 3: Shopping Cart ---")
epic3 = create_issue(
    "Epic: Shopping Cart",
    "Shopping cart functionality including add/remove items, quantity management, persistence, and discount code support.",
    EPIC
)
epics['cart'] = epic3

if epic3:
    create_issue(
        "Add and remove items from cart",
        "As a shopper, I want to add and remove items from my cart so I can manage my purchases.\n\n"
        "Acceptance Criteria:\n"
        "- 'Add to cart' button on product listing and detail pages\n"
        "- Cart slide-out panel shows items, quantities, subtotal\n"
        "- +/- quantity controls, direct input, remove button\n"
        "- Max 99 units per product\n"
        "- Cart badge shows item count in header\n"
        "- Animated feedback on add/remove\n"
        "- Persist cart for logged-in users (server-side)\n"
        "- Guest cart stored in localStorage, merge on login",
        STORY, epic3
    )

    create_issue(
        "Cart persistence across sessions",
        "Cart persists.",
        STORY, epic3
    )

    create_issue(
        "Apply discount codes",
        "As a shopper, I want to apply discount codes at checkout so I can get promotional pricing.\n\n"
        "Acceptance Criteria:\n"
        "- Discount code input field in cart summary\n"
        "- Support codes: percentage off, fixed amount, free shipping\n"
        "- Validate code: exists, not expired, meets minimum order\n"
        "- Show discount amount in cart summary\n"
        "- One code per order\n"
        "- Admin: CRUD for discount codes with expiry dates and usage limits",
        STORY, epic3
    )

# ── Epic 4: Checkout & Payments ──
print("\n--- Epic 4: Checkout & Payments ---")
epic4 = create_issue(
    "Epic: Checkout and Payments",
    "End-to-end checkout flow with Stripe integration, order processing, and confirmation notifications.",
    EPIC
)
epics['payments'] = epic4

if epic4:
    create_issue(
        "Stripe payment integration",
        "As a shopper, I want to pay with credit card via Stripe so I can complete my purchase securely.\n\n"
        "Acceptance Criteria:\n"
        "- Stripe Elements for card input (PCI compliance)\n"
        "- Support: Visa, Mastercard, Amex\n"
        "- 3D Secure for European cards\n"
        "- Save card for returning customers (opt-in)\n"
        "- Handle declined cards with clear error message\n"
        "- Webhook: payment_intent.succeeded, payment_intent.failed\n"
        "- Idempotency keys for retry safety\n\n"
        "Technical Notes:\n"
        "- Server-side PaymentIntent creation\n"
        "- Never log full card numbers\n"
        "- Test with Stripe test cards before go-live",
        STORY, epic4
    )

    create_issue(
        "Order confirmation email",
        "As a shopper, I want to receive a confirmation email after purchase so I have a record of my order.\n\n"
        "Acceptance Criteria:\n"
        "- HTML email with order summary\n"
        "- Include: order #, items, quantities, prices, total, shipping address\n"
        "- Estimated delivery date\n"
        "- Link to order tracking page\n"
        "- Send within 60 seconds of payment confirmation\n\n"
        "Technical Notes:\n"
        "- Use SendGrid template\n"
        "- Queue via background job (not inline)\n"
        "- Retry up to 3 times on failure",
        STORY, epic4
    )

    create_issue(
        "Payment fails with special characters in address",
        "Bug: Payments are rejected when shipping address contains accented characters (e.g., José, Zürich). "
        "Stripe returns invalid_request_error. Need to properly encode UTF-8 in payment metadata.",
        BUG, epic4
    )


# ══════════════════════════════════════════════════════
# STEP 2: Create Confluence Pages
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("STEP 2: Creating Confluence Pages")
print("=" * 60)

homepage_id = get_homepage_id()
print(f"  Space homepage ID: {homepage_id}")

# ── Architecture Decision Records ──
print("\n--- Architecture Pages ---")
adr_page = create_confluence_page(
    "Architecture Decision Records",
    """
    <h2>ADR-001: Monolithic API with Modular Services</h2>
    <p><strong>Status:</strong> Accepted</p>
    <p><strong>Context:</strong> We need to decide between microservices and a monolithic architecture for the e-commerce platform.</p>
    <p><strong>Decision:</strong> Start with a modular monolith. Each domain (auth, catalog, cart, payments) is a separate module with clear boundaries. This allows future extraction to microservices if needed.</p>
    <p><strong>Consequences:</strong> Simpler deployment and debugging initially. Modules must maintain strict interfaces to allow future extraction.</p>

    <h2>ADR-002: JWT Authentication with Refresh Tokens</h2>
    <p><strong>Status:</strong> Accepted</p>
    <p><strong>Context:</strong> Need a stateless authentication mechanism that works across the API and future mobile apps.</p>
    <p><strong>Decision:</strong> Use JWT access tokens (15 min) + httpOnly refresh cookies with rotation. Store refresh token hashes in Redis.</p>
    <p><strong>Consequences:</strong> Stateless API calls. Refresh token rotation prevents token theft. Redis becomes a critical dependency for auth.</p>

    <h2>ADR-003: Elasticsearch for Product Search</h2>
    <p><strong>Status:</strong> Accepted</p>
    <p><strong>Context:</strong> Product search needs to support fuzzy matching, faceted navigation, and fast response times at scale.</p>
    <p><strong>Decision:</strong> Use Elasticsearch as the search engine. Sync product data from PostgreSQL to ES via change data capture (Debezium).</p>
    <p><strong>Consequences:</strong> Powerful search capabilities. Additional infrastructure to manage. Data consistency lag between DB and ES (eventual consistency).</p>

    <h2>ADR-004: Stripe for Payment Processing</h2>
    <p><strong>Status:</strong> Accepted</p>
    <p><strong>Context:</strong> Need a PCI-compliant payment provider that supports multiple card types and 3D Secure.</p>
    <p><strong>Decision:</strong> Use Stripe with Payment Intents API and Stripe Elements for card collection.</p>
    <p><strong>Consequences:</strong> PCI compliance simplified (SAQ A). Stripe fees apply. Vendor lock-in risk mitigated by payment abstraction layer.</p>
    """,
    homepage_id
)

# ── API Design ──
api_page = create_confluence_page(
    "API Design — E-Commerce Platform",
    """
    <h2>Authentication Endpoints</h2>
    <table>
    <tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr>
    <tr><td>POST</td><td>/api/auth/register</td><td>Create account</td><td>Public</td></tr>
    <tr><td>POST</td><td>/api/auth/login</td><td>Email + password login</td><td>Public</td></tr>
    <tr><td>POST</td><td>/api/auth/oauth/google</td><td>Google OAuth flow</td><td>Public</td></tr>
    <tr><td>POST</td><td>/api/auth/refresh</td><td>Rotate refresh token</td><td>Cookie</td></tr>
    <tr><td>POST</td><td>/api/auth/logout</td><td>Invalidate session</td><td>Required</td></tr>
    <tr><td>POST</td><td>/api/auth/forgot-password</td><td>Send reset email</td><td>Public</td></tr>
    <tr><td>POST</td><td>/api/auth/reset-password</td><td>Confirm new password</td><td>Token</td></tr>
    </table>

    <h2>Product Catalog Endpoints</h2>
    <table>
    <tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr>
    <tr><td>GET</td><td>/api/products</td><td>List products with filters</td><td>Public</td></tr>
    <tr><td>GET</td><td>/api/products/:id</td><td>Product detail</td><td>Public</td></tr>
    <tr><td>GET</td><td>/api/products/search</td><td>Full-text search</td><td>Public</td></tr>
    <tr><td>GET</td><td>/api/categories</td><td>Category tree</td><td>Public</td></tr>
    <tr><td>POST</td><td>/api/admin/products</td><td>Create product</td><td>Admin</td></tr>
    <tr><td>PUT</td><td>/api/admin/products/:id</td><td>Update product</td><td>Admin</td></tr>
    </table>

    <h2>Cart Endpoints</h2>
    <table>
    <tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr>
    <tr><td>GET</td><td>/api/cart</td><td>Get current cart</td><td>Required</td></tr>
    <tr><td>POST</td><td>/api/cart/items</td><td>Add item to cart</td><td>Required</td></tr>
    <tr><td>PUT</td><td>/api/cart/items/:id</td><td>Update quantity</td><td>Required</td></tr>
    <tr><td>DELETE</td><td>/api/cart/items/:id</td><td>Remove item</td><td>Required</td></tr>
    <tr><td>POST</td><td>/api/cart/discount</td><td>Apply discount code</td><td>Required</td></tr>
    </table>

    <h2>Payment Endpoints</h2>
    <table>
    <tr><th>Method</th><th>Endpoint</th><th>Description</th><th>Auth</th></tr>
    <tr><td>POST</td><td>/api/checkout/create-payment-intent</td><td>Initialize Stripe payment</td><td>Required</td></tr>
    <tr><td>POST</td><td>/api/webhooks/stripe</td><td>Stripe webhook handler</td><td>Signature</td></tr>
    <tr><td>GET</td><td>/api/orders/:id</td><td>Order confirmation</td><td>Required</td></tr>
    <tr><td>GET</td><td>/api/orders</td><td>Order history</td><td>Required</td></tr>
    </table>
    """,
    homepage_id
)

# ── Sprint Planning ──
sprint_page = create_confluence_page(
    "Sprint Planning — E-Commerce Platform",
    """
    <h2>Sprint 1: Authentication Foundation</h2>
    <p><strong>Goal:</strong> Users can register, log in, and manage sessions.</p>
    <ul>
    <li>Login with email and password (Story)</li>
    <li>OAuth integration with Google (Story)</li>
    <li>Fix: Session expires unexpectedly (Bug)</li>
    </ul>

    <h2>Sprint 2: Product Catalog</h2>
    <p><strong>Goal:</strong> Users can browse and search products.</p>
    <ul>
    <li>Product listing page with filters (Story)</li>
    <li>Product detail page (Story)</li>
    <li>Search functionality (Story)</li>
    <li>Product categories taxonomy (Task)</li>
    </ul>

    <h2>Sprint 3: Shopping Cart</h2>
    <p><strong>Goal:</strong> Users can manage their shopping cart.</p>
    <ul>
    <li>Add and remove items from cart (Story)</li>
    <li>Cart persistence across sessions (Story)</li>
    <li>Apply discount codes (Story)</li>
    </ul>

    <h2>Sprint 4: Checkout & Payments</h2>
    <p><strong>Goal:</strong> Users can complete purchases.</p>
    <ul>
    <li>Stripe payment integration (Story)</li>
    <li>Order confirmation email (Story)</li>
    <li>Fix: Payment fails with special characters (Bug)</li>
    </ul>
    """,
    homepage_id
)

# ── Technical Documentation ──
tech_page = create_confluence_page(
    "Technical Documentation — E-Commerce Platform",
    """
    <h2>System Architecture</h2>
    <p>The platform follows a modular monolith architecture with the following components:</p>
    <ul>
    <li><strong>API Server:</strong> Node.js with Express, TypeScript</li>
    <li><strong>Database:</strong> PostgreSQL 15 with Prisma ORM</li>
    <li><strong>Cache:</strong> Redis for sessions and rate limiting</li>
    <li><strong>Search:</strong> Elasticsearch for product catalog</li>
    <li><strong>Payments:</strong> Stripe via Payment Intents API</li>
    <li><strong>Email:</strong> SendGrid with Handlebars templates</li>
    <li><strong>CDN:</strong> CloudFront for static assets and images</li>
    </ul>

    <h2>Authentication Flow</h2>
    <ol>
    <li>User submits email + password to <code>/api/auth/login</code></li>
    <li>Server validates credentials against bcrypt hash in DB</li>
    <li>On success: generate JWT access token (15 min) + refresh token (7 days)</li>
    <li>Access token returned in response body, refresh token in httpOnly cookie</li>
    <li>Client includes <code>Authorization: Bearer &lt;token&gt;</code> on API calls</li>
    <li>When access token expires, client calls <code>/api/auth/refresh</code></li>
    <li>Server validates refresh token, issues new access + refresh pair (rotation)</li>
    </ol>

    <h2>Product Data Model</h2>
    <table>
    <tr><th>Field</th><th>Type</th><th>Description</th></tr>
    <tr><td>id</td><td>UUID</td><td>Primary key</td></tr>
    <tr><td>name</td><td>varchar(255)</td><td>Product name</td></tr>
    <tr><td>description</td><td>text</td><td>Full description (Markdown)</td></tr>
    <tr><td>price</td><td>decimal(10,2)</td><td>Price in USD</td></tr>
    <tr><td>sku</td><td>varchar(50)</td><td>Unique stock keeping unit</td></tr>
    <tr><td>category_id</td><td>UUID</td><td>FK to categories</td></tr>
    <tr><td>stock</td><td>integer</td><td>Available inventory</td></tr>
    <tr><td>images</td><td>jsonb</td><td>Array of image URLs</td></tr>
    <tr><td>rating</td><td>decimal(2,1)</td><td>Average rating (0-5)</td></tr>
    <tr><td>created_at</td><td>timestamp</td><td>Creation time</td></tr>
    </table>

    <h2>Deployment</h2>
    <p>Docker Compose for development, AWS ECS for production. CI/CD via GitHub Actions.</p>
    """,
    homepage_id
)

# ── Intentionally inconsistent page (for testing inconsistency detection) ──
wiki_page = create_confluence_page(
    "Project Wiki — Unfinished Notes",
    """
    <h2>TODO: Fill this in</h2>
    <p>This page is intentionally left incomplete to test inconsistency detection.</p>
    <p>Some notes about the project that don't match any Jira tickets:</p>
    <ul>
    <li>We should add a wishlist feature</li>
    <li>Consider adding social login with Facebook</li>
    <li>Maybe add a chatbot for customer support</li>
    </ul>
    """,
    homepage_id
)


# ══════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("SUMMARY")
print("=" * 60)
print(f"""
Created test data for Rovo Execution Guard testing.

Jira Project: {PROJECT_KEY}
  - 4 Epics (User Auth, Product Catalog, Shopping Cart, Checkout & Payments)
  - 8 Stories (4 with rich descriptions + acceptance criteria, 4 with poor descriptions)
  - 2 Bugs (with detailed reproduction info)
  - 1 Task (categories taxonomy)

Confluence Space: {SPACE_KEY}
  - Architecture Decision Records (4 ADRs)
  - API Design (all endpoints documented)
  - Sprint Planning (4 sprints mapped to epics)
  - Technical Documentation (architecture, auth flow, data model)
  - Intentionally incomplete wiki page (for inconsistency testing)

Test Scenarios:
  1. Move a rich story (Login) to In Progress → should PASS definition gate
  2. Move a poor story (Password reset) to In Progress → should FAIL definition gate
  3. Move a story to In Review → checks consistency with Confluence
  4. Open Issue Panel → check consistency scores and enrich poor tickets
  5. The "Project Wiki" page mentions features NOT in Jira → inconsistency detection
""")

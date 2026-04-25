#!/usr/bin/env bash
# ralph-pipeline.sh — Sequential Build Pipeline for Rovo Execution Guard
# Runs RTASK-001 through RTASK-032 in dependency order with QA gate enforcement.
#
# Usage:
#   ./scripts/ralph-pipeline.sh              # Run from RTASK-005 (default resume point)
#   ./scripts/ralph-pipeline.sh --from 006   # Start from a specific task
#   ./scripts/ralph-pipeline.sh --from 001   # Run all tasks from the beginning
#   ./scripts/ralph-pipeline.sh --dry-run    # Show what would run without executing
#   ./scripts/ralph-pipeline.sh --exclusive  # Use --exclusive flag on each ralph run

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
RALPH_CONFIG="$PROJECT_DIR/ralph.yml"
TASKS_DIR="$PROJECT_DIR/.ralph/tasks"
LOG_DIR="$PROJECT_DIR/.ralph/pipeline-logs"

# Task execution order (dependency-resolved, sequential)
TASKS=(
  "001-project-foundation"
  "002-rulebook"
  "003-typescript-eslint-prettier"
  "004-husky-commitlint-lintstaged"
  "005-domain-types-models"
  "006-domain-scoring-engine"
  "007-domain-inconsistency-detector"
  "008-domain-quality-gate-rules"
  "013-integration-resilience"
  "021-observability-structured-logger"
  "024-configuration-project-settings"
  "009-integration-jira-adapter"
  "010-integration-rovo-adapter"
  "011-integration-github-adapter"
  "012-integration-confluence-adapter"
  "022-observability-sentry"
  "014-orchestration-jira-triggers"
  "015-orchestration-resolvers"
  "016-orchestration-github-webhook"
  "017-orchestration-enforcement-actions"
  "025-cicd-github-actions"
  "023-observability-health-checks"
  "026-cicd-semantic-release"
  "018-presentation-jira-issue-panel"
  "019-presentation-admin-dashboard"
  "020-presentation-github-pr-comments"
  "027-testing-jest-unit-suite"
  "028-testing-integration-tests"
  "029-testing-e2e-playwright"
  "030-documentation-readmes-marketplace"
  "031-audit-coverage"
  "032-ralph-hats-and-guardrails"
)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Defaults
FROM_TASK=""
DRY_RUN=false
EXCLUSIVE=""
COMPLETED=()
FAILED=()
SKIPPED=()
CURRENT_IDX=0

# --- Functions ---

log()  { echo -e "${CYAN}[PIPELINE]${NC} $*"; }
ok()   { echo -e "${GREEN}[PASS]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*"; }
fail() { echo -e "${RED}[FAIL]${NC} $*"; }

task_file() {
  local task="$1"
  local primary="${TASKS_DIR}/RTASK-${task}.code-task.md"
  local fallback="${TASKS_DIR}/donotuse/RTASK-${task}.code-task.md"
  if [ -f "$primary" ]; then
    echo "$primary"
  elif [ -f "$fallback" ]; then
    echo "$fallback"
  else
    echo "$primary"  # return primary path for error message
  fi
}

task_id() {
  local task="$1"
  echo "$task" | cut -d'-' -f1
}

task_name() {
  local task="$1"
  echo "$task" | cut -d'-' -f2-
}

run_qa_gates() {
  local gates_pass=true

  log "Running QA gates..."

  if [ "$DRY_RUN" = true ]; then
    ok "(dry-run) All QA gates would pass"
    return 0
  fi

  # Typecheck
  if npm run typecheck --prefix "$PROJECT_DIR" > /dev/null 2>&1; then
    ok "typecheck passed"
  else
    fail "typecheck FAILED"
    gates_pass=false
  fi

  # Lint
  if npm run lint --prefix "$PROJECT_DIR" > /dev/null 2>&1; then
    ok "lint passed"
  else
    fail "lint FAILED"
    gates_pass=false
  fi

  # Format check
  if npm run format:check --prefix "$PROJECT_DIR" > /dev/null 2>&1; then
    ok "format:check passed"
  else
    fail "format:check FAILED"
    gates_pass=false
  fi

  # Unit tests
  if npm run test:unit --prefix "$PROJECT_DIR" > /dev/null 2>&1; then
    ok "test:unit passed"
  else
    fail "test:unit FAILED"
    gates_pass=false
  fi

  if [ "$gates_pass" = true ]; then
    return 0
  else
    return 1
  fi
}

run_task() {
  local task="$1"
  local id
  id=$(task_id "$task")
  local name
  name=$(task_name "$task")
  local file
  file=$(task_file "$task")

  log "═══════════════════════════════════════════════════════"
  log "Starting RTASK-${id}: ${name}"
  log "═══════════════════════════════════════════════════════"

  if [ ! -f "$file" ]; then
    fail "Task file not found: $file"
    FAILED+=("RTASK-${id}")
    return 1
  fi

  if [ "$DRY_RUN" = true ]; then
    warn "(dry-run) Would run: ralph run -c ralph.yml ${EXCLUSIVE} -P \"$file\""
    COMPLETED+=("RTASK-${id}")
    return 0
  fi

  local log_file="${LOG_DIR}/RTASK-${id}-$(date +%Y%m%d-%H%M%S).log"
  mkdir -p "$LOG_DIR"

  if ralph run -c "$RALPH_CONFIG" $EXCLUSIVE -P "$file" 2>&1 | tee "$log_file"; then
    # Ralph completed — now run QA gates
    if run_qa_gates; then
      ok "RTASK-${id} completed — all QA gates passed"
      COMPLETED+=("RTASK-${id}")
      return 0
    else
      fail "RTASK-${id} completed but QA gates FAILED"
      FAILED+=("RTASK-${id}")
      return 1
    fi
  else
    fail "RTASK-${id} ralph run FAILED (exit code: $?)"
    FAILED+=("RTASK-${id}")
    return 1
  fi
}

print_summary() {
  echo ""
  log "═══════════════════════════════════════════════════════"
  log "PIPELINE SUMMARY"
  log "═══════════════════════════════════════════════════════"
  echo ""

  if [ ${#COMPLETED[@]} -gt 0 ]; then
    ok "Completed (${#COMPLETED[@]}):"
    for t in "${COMPLETED[@]}"; do
      echo "  ✓ $t"
    done
  fi

  if [ ${#SKIPPED[@]} -gt 0 ]; then
    warn "Skipped (${#SKIPPED[@]}):"
    for t in "${SKIPPED[@]}"; do
      echo "  ⊘ $t"
    done
  fi

  if [ ${#FAILED[@]} -gt 0 ]; then
    fail "Failed (${#FAILED[@]}):"
    for t in "${FAILED[@]}"; do
      echo "  ✗ $t"
    done
    echo ""
    fail "Pipeline halted. Fix failed tasks and re-run with --from <next-task>."
    exit 1
  fi

  echo ""
  if [ "$CURRENT_IDX" -eq "${#TASKS[@]}" ]; then
    ok "All tasks completed successfully!"
    echo ""
    log "Running final project-wide QA gates..."
    run_qa_gates
  fi
}

# --- Parse Args ---

while [[ $# -gt 0 ]]; do
  case $1 in
    --from)
      FROM_TASK="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --exclusive)
      EXCLUSIVE="--exclusive"
      shift
      ;;
    -h|--help)
      echo "Usage: $0 [--from NNN] [--dry-run] [--exclusive]"
      echo ""
      echo "Options:"
      echo "  --from NNN     Start from task number (e.g., 006). Default: 005"
      echo "  --dry-run      Show what would run without executing"
      echo "  --exclusive    Use --exclusive flag on ralph run"
      echo ""
      echo "Tasks in order:"
      for t in "${TASKS[@]}"; do
        echo "  RTASK-$(task_id "$t") — $(task_name "$t")"
      done
      exit 0
      ;;
    *)
      fail "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Default resume point: RTASK-005 (first incomplete task)
if [ -z "$FROM_TASK" ]; then
  FROM_TASK="005"
fi

# --- Main ---

cd "$PROJECT_DIR"

log "Rovo Execution Guard — Sequential Build Pipeline"
log "Resume from: RTASK-${FROM_TASK}"
log "Config: $RALPH_CONFIG"
log "Logs: $LOG_DIR"
echo ""

# Find starting index
START_IDX=0
for i in "${!TASKS[@]}"; do
  id=$(task_id "${TASKS[$i]}")
  if [ "$id" = "$FROM_TASK" ]; then
    START_IDX=$i
    break
  fi
done

# Mark tasks before start as skipped (already done)
for i in $(seq 0 $((START_IDX - 1))); do
  id=$(task_id "${TASKS[$i]}")
  SKIPPED+=("RTASK-${id}")
done

# Execute tasks from start index
for i in $(seq $START_IDX $(( ${#TASKS[@]} - 1 ))); do
  CURRENT_IDX=$((i + 1))
  task="${TASKS[$i]}"

  if ! run_task "$task"; then
    print_summary
    exit 1
  fi
  echo ""
done

CURRENT_IDX=${#TASKS[@]}
print_summary

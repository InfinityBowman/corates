#!/bin/bash
# Quick check for common anti-patterns in CoRATES codebase
# Usage: ./quick-check.sh [path]

TARGET="${1:-packages}"

echo "=== CoRATES Code Review Quick Check ==="
echo "Scanning: $TARGET"
echo ""

# Colors
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

echo "--- CRITICAL ISSUES ---"
echo ""

# Prop destructuring in components
echo -e "${RED}[CRITICAL] Prop Destructuring:${NC}"
grep -rn "function.*Component.*({" "$TARGET/web/src/components/" 2>/dev/null | head -10
grep -rn "export function.*({" "$TARGET/web/src/components/" 2>/dev/null | grep -v "export function use" | head -10
echo ""

# Wrong Ark UI imports
echo -e "${RED}[CRITICAL] Wrong Ark UI Imports:${NC}"
grep -rn "from.*components.*Dialog\|from.*components.*Select\|from.*components.*Toast\|from.*components.*Avatar" "$TARGET/web/src/" 2>/dev/null | grep -v "@corates/ui" | head -10
echo ""

# Unvalidated request bodies
echo -e "${RED}[CRITICAL] Unvalidated Request Bodies:${NC}"
grep -rn "c\.req\.json()" "$TARGET/workers/src/routes/" 2>/dev/null | head -10
echo ""

# Missing auth check
echo -e "${RED}[CRITICAL] Direct c.get('user') without getter:${NC}"
grep -rn "c\.get('user')" "$TARGET/workers/src/routes/" 2>/dev/null | head -10
echo ""

echo "--- WARNINGS ---"
echo ""

# Raw error objects
echo -e "${YELLOW}[WARNING] Raw Error Objects:${NC}"
grep -rn "c\.json({ error:" "$TARGET/workers/src/routes/" 2>/dev/null | head -10
echo ""

# Deep relative imports
echo -e "${YELLOW}[WARNING] Deep Relative Imports:${NC}"
grep -rn "from '\.\./\.\./\.\." "$TARGET/web/src/components/" 2>/dev/null | head -10
echo ""

# Too many props (rough check)
echo -e "${YELLOW}[WARNING] Potential Prop Drilling (many props):${NC}"
grep -rn "<[A-Z][a-zA-Z]*.*=.*=.*=.*=.*=" "$TARGET/web/src/components/" 2>/dev/null | head -10
echo ""

# Missing try-catch around db operations
echo -e "${YELLOW}[WARNING] DB Operations (verify try-catch):${NC}"
grep -rn "await db\." "$TARGET/workers/src/routes/" 2>/dev/null | head -10
echo ""

echo "=== Quick Check Complete ==="
echo "Review flagged items manually for false positives."

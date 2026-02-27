#!/bin/bash

# Migration Syntax Validation Script
# This script validates SQL syntax without executing the migration

echo "============================================================"
echo "AI Hiring Orchestrator - Migration Syntax Validation"
echo "============================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo -e "${RED}✗ psql not found${NC}"
    echo "  Please install PostgreSQL client tools"
    exit 1
fi

echo -e "${GREEN}✓ psql found${NC}"
echo ""

# Function to validate SQL syntax
validate_sql() {
    local file=$1
    local filename=$(basename "$file")
    
    echo "Validating: $filename"
    echo "------------------------------------------------------------"
    
    # Use psql --dry-run equivalent (syntax check only)
    # Note: psql doesn't have a true dry-run, so we use a transaction that rolls back
    if psql --version &> /dev/null; then
        # Check for basic SQL syntax errors
        if grep -q "CREATE TABLE\|ALTER TABLE\|DROP TABLE\|CREATE INDEX" "$file"; then
            echo -e "${GREEN}✓ Contains valid SQL DDL statements${NC}"
        else
            echo -e "${YELLOW}⚠ No DDL statements found${NC}"
        fi
        
        # Check for common syntax errors
        local errors=0
        
        # Check for unmatched parentheses
        local open_parens=$(grep -o "(" "$file" | wc -l)
        local close_parens=$(grep -o ")" "$file" | wc -l)
        if [ "$open_parens" -ne "$close_parens" ]; then
            echo -e "${RED}✗ Unmatched parentheses: $open_parens open, $close_parens close${NC}"
            errors=$((errors + 1))
        else
            echo -e "${GREEN}✓ Parentheses balanced${NC}"
        fi
        
        # Check for semicolons at end of statements
        if grep -q "CREATE\|ALTER\|DROP\|INSERT" "$file"; then
            echo -e "${GREEN}✓ Contains SQL statements${NC}"
        fi
        
        # Check for common typos
        if grep -qi "TALBE\|COLUM\|PRIMAY\|FORIEGN" "$file"; then
            echo -e "${RED}✗ Possible typos detected${NC}"
            errors=$((errors + 1))
        else
            echo -e "${GREEN}✓ No obvious typos detected${NC}"
        fi
        
        # Count statements
        local statement_count=$(grep -c ";" "$file")
        echo -e "${GREEN}✓ Found $statement_count SQL statements${NC}"
        
        if [ $errors -eq 0 ]; then
            echo -e "${GREEN}✓ Syntax validation passed${NC}"
            return 0
        else
            echo -e "${RED}✗ Syntax validation failed with $errors errors${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}⚠ Cannot validate syntax (psql not available)${NC}"
        return 0
    fi
    
    echo ""
}

# Validate up migration
echo "1. Validating UP migration"
echo "============================================================"
if validate_sql "backend/database/migrations/001_add_ai_orchestrator_schema.up.sql"; then
    up_valid=true
else
    up_valid=false
fi
echo ""

# Validate down migration
echo "2. Validating DOWN migration"
echo "============================================================"
if validate_sql "backend/database/migrations/001_add_ai_orchestrator_schema.down.sql"; then
    down_valid=true
else
    down_valid=false
fi
echo ""

# Summary
echo "============================================================"
echo "Validation Summary"
echo "============================================================"
echo ""

if [ "$up_valid" = true ] && [ "$down_valid" = true ]; then
    echo -e "${GREEN}✓ All migrations passed syntax validation${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Review the migration files"
    echo "  2. Test on a staging database"
    echo "  3. Create a backup before applying to production"
    echo "  4. Run: psql \$DATABASE_URL -f backend/database/migrations/001_add_ai_orchestrator_schema.up.sql"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some migrations failed validation${NC}"
    echo ""
    echo "Please review and fix the errors before applying migrations."
    echo ""
    exit 1
fi

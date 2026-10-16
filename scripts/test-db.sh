#!/usr/bin/env bash
# Aplica las migraciones a una base de datos PostgreSQL vacía y ejecuta la
# comprobación de seguridad (RLS). Necesita psql y un servidor PostgreSQL.
#
#   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/postgres npm run test:db
#
# La base de datos indicada solo se usa para crear y borrar una base temporal.
set -euo pipefail
cd "$(dirname "$0")/.."

ADMIN_URL="${TEST_DATABASE_URL:?Define TEST_DATABASE_URL (servidor PostgreSQL de pruebas)}"
DB="plataforma_ia_test_$$"
TEST_URL="${ADMIN_URL%/*}/$DB"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

"${PSQL[@]}" "$ADMIN_URL" -c "create database $DB"
trap '"${PSQL[@]}" "$ADMIN_URL" -c "drop database if exists $DB with (force)" >/dev/null' EXIT

"${PSQL[@]}" "$TEST_URL" -f tests/db/supabase-stub.sql
for f in supabase/migrations/*.sql; do
  echo "· migración $(basename "$f")"
  "${PSQL[@]}" "$TEST_URL" -f "$f"
done
echo "· comprobación de seguridad"
"${PSQL[@]}" "$TEST_URL" -f supabase/tests/comprobar_seguridad.sql
echo "OK: migraciones aplicadas y comprobaciones de seguridad superadas"

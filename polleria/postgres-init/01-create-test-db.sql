SELECT 'CREATE DATABASE polleria_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'polleria_test')\gexec

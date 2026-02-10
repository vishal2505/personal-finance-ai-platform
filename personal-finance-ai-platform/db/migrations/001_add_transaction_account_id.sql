-- Run this if your transactions table was created without account_id.
-- MySQL: run with your DB selected, e.g. mysql -u user -p personal_finance < 001_add_transaction_account_id.sql
ALTER TABLE transactions ADD COLUMN account_id INT NULL;
ALTER TABLE transactions ADD CONSTRAINT fk_transactions_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL;

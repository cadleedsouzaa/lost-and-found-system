-- File: database_setup.sql
-- Description: SQL commands to set up the lost_and_found_db database schema and triggers.

SET FOREIGN_KEY_CHECKS = 0; -- Disable foreign key checks

-- ------------------------------------------------------
-- Database Creation (Keep this if you dropped the DB, otherwise optional)
-- ------------------------------------------------------
CREATE DATABASE IF NOT EXISTS lost_and_found_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE lost_and_found_db;

-- ------------------------------------------------------
-- Drop Tables (Order doesn't strictly matter now, but good practice)
-- ------------------------------------------------------
DROP TABLE IF EXISTS `item_matching`;
DROP TABLE IF EXISTS `escrow`;
DROP TABLE IF EXISTS `claim_requests`;
DROP TABLE IF EXISTS `lost_items`;
DROP TABLE IF EXISTS `found_item`;
DROP TABLE IF EXISTS `users`; -- Should work now

-- ------------------------------------------------------
-- Create Table Structure `users`
-- ------------------------------------------------------
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) DEFAULT NULL,
  `email` varchar(100) UNIQUE DEFAULT NULL,
  `phone` varchar(15) DEFAULT NULL,
  `password_hash` varchar(255) NULL,
  `registered_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Create Table Structure `lost_items`
-- ------------------------------------------------------
CREATE TABLE `lost_items` (
  `item_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `item_name` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` text,
  `lost_date` date DEFAULT NULL,
  `lost_location` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Reported',
  `reported_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`item_id`),
  KEY `fk_lost_user` (`user_id`),
  CONSTRAINT `fk_lost_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ... (Include the CREATE TABLE statements for found_item, claim_requests, item_matching, escrow here - same as before) ...
-- ------------------------------------------------------
-- Table Structure for `found_item`
-- ------------------------------------------------------
CREATE TABLE `found_item` (
  `found_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `item_name` varchar(100) DEFAULT NULL,
  `category` varchar(50) DEFAULT NULL,
  `description` text,
  `found_date` date DEFAULT NULL,
  `found_location` varchar(255) DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Available',
  `reported_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`found_id`),
  KEY `fk_found_user` (`user_id`),
  CONSTRAINT `fk_found_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Table Structure for `claim_requests`
-- ------------------------------------------------------
CREATE TABLE `claim_requests` (
  `claim_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `found_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'pending',
  `requested_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`claim_id`),
  UNIQUE KEY `unique_user_claim` (`user_id`,`found_id`),
  KEY `fk_claim_user` (`user_id`),
  KEY `fk_claim_found` (`found_id`),
  CONSTRAINT `fk_claim_found` FOREIGN KEY (`found_id`) REFERENCES `found_item` (`found_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_claim_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Table Structure for `item_matching`
-- ------------------------------------------------------
CREATE TABLE `item_matching` (
  `match_id` int NOT NULL AUTO_INCREMENT,
  `lost_item_id` int DEFAULT NULL,
  `found_item_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Suggested',
  `matched_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`match_id`),
  UNIQUE KEY `unique_match` (`lost_item_id`,`found_item_id`),
  KEY `fk_match_lost` (`lost_item_id`),
  KEY `fk_match_found` (`found_item_id`),
  CONSTRAINT `fk_match_found` FOREIGN KEY (`found_item_id`) REFERENCES `found_item` (`found_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_match_lost` FOREIGN KEY (`lost_item_id`) REFERENCES `lost_items` (`item_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------
-- Table Structure for `escrow`
-- ------------------------------------------------------
CREATE TABLE `escrow` (
  `escrow_id` int NOT NULL AUTO_INCREMENT,
  `found_id` int DEFAULT NULL,
  `lost_item_id` int DEFAULT NULL,
  `status` varchar(20) DEFAULT 'Holding',
  `claimed_at` datetime DEFAULT NULL,
  `released_at` datetime DEFAULT NULL,
  PRIMARY KEY (`escrow_id`),
  KEY `fk_escrow_found` (`found_id`),
  KEY `fk_escrow_lost` (`lost_item_id`),
  CONSTRAINT `fk_escrow_found` FOREIGN KEY (`found_id`) REFERENCES `found_item` (`found_id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_escrow_lost` FOREIGN KEY (`lost_item_id`) REFERENCES `lost_items` (`item_id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ------------------------------------------------------
-- Triggers (Drop and Recreate)
-- ------------------------------------------------------
DROP TRIGGER IF EXISTS trg_after_claim_update;

DELIMITER //
CREATE TRIGGER trg_after_claim_update
-- ... (trigger definition same as before) ...
AFTER UPDATE ON claim_requests
FOR EACH ROW
BEGIN
    IF NEW.status = 'Approved' AND OLD.status != 'Approved' THEN
        UPDATE found_item SET status = 'Claimed' WHERE found_id = NEW.found_id;
        INSERT INTO escrow (found_id, lost_item_id, status, claimed_at) VALUES (NEW.found_id, NULL, 'Holding', NOW());
    ELSEIF NEW.status = 'Rejected' AND OLD.status = 'pending' THEN
        IF NOT EXISTS (SELECT 1 FROM claim_requests WHERE found_id = NEW.found_id AND status = 'Approved') THEN
             UPDATE found_item SET status = 'Available' WHERE found_id = NEW.found_id;
        END IF;
    END IF;
END; //
DELIMITER ;


DROP TRIGGER IF EXISTS trg_after_match_confirmed;

DELIMITER //
CREATE TRIGGER trg_after_match_confirmed
-- ... (trigger definition same as before) ...
AFTER UPDATE ON item_matching
FOR EACH ROW
BEGIN
    IF NEW.status = 'Confirmed' AND OLD.status != 'Confirmed' THEN
        UPDATE lost_items SET status = 'Matched' WHERE item_id = NEW.lost_item_id;
        UPDATE found_item SET status = 'Matched' WHERE found_id = NEW.found_item_id;
    END IF;
END; //
DELIMITER ;


-- ------------------------------------------------------
-- Re-enable foreign key checks (IMPORTANT!)
-- ------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------
-- End of Setup Script
-- --------------------------------------------------
----
INSERT INTO users (user_id, name, email) VALUES (2, 'Test User Two', 'test2@example.com');
-- Insert a basic user row with ID 1 (adjust details if needed)
-- Make sure password_hash allows NULL if you don't provide one here
INSERT INTO users (user_id, name, email) VALUES (1, 'Test User One', 'test1@example.com');
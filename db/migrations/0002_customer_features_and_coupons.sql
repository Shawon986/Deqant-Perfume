-- DEQANT customer addresses, verified product reviews and offline-checkout coupons.
ALTER TABLE `orders`
  ADD COLUMN `discountAmount` INT NOT NULL DEFAULT 0,
  ADD COLUMN `couponCode` VARCHAR(40) NULL;

CREATE TABLE `customer_addresses` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `userId` BIGINT UNSIGNED NOT NULL,
  `label` VARCHAR(60) NOT NULL DEFAULT 'Home',
  `recipientName` VARCHAR(180) NOT NULL,
  `phone` VARCHAR(30) NOT NULL,
  `district` VARCHAR(120) NOT NULL,
  `area` VARCHAR(160) NOT NULL,
  `address` TEXT NOT NULL,
  `instructions` VARCHAR(1000) NULL,
  `isDefault` BOOLEAN NOT NULL DEFAULT FALSE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `customer_addresses_user_idx` (`userId`),
  CONSTRAINT `customer_addresses_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE
);

CREATE TABLE `product_reviews` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `productId` BIGINT UNSIGNED NOT NULL,
  `userId` BIGINT UNSIGNED NOT NULL,
  `orderId` BIGINT UNSIGNED NOT NULL,
  `rating` INT NOT NULL,
  `title` VARCHAR(120) NOT NULL,
  `body` TEXT NOT NULL,
  `status` ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `product_reviews_product_idx` (`productId`),
  UNIQUE KEY `product_reviews_verified_unique` (`productId`,`userId`),
  CONSTRAINT `product_reviews_product_fk` FOREIGN KEY (`productId`) REFERENCES `products` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_reviews_user_fk` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `product_reviews_order_fk` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE
);

CREATE TABLE `coupons` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `code` VARCHAR(40) NOT NULL,
  `discountType` ENUM('percent','fixed') NOT NULL,
  `discountValue` INT NOT NULL,
  `minSubtotal` INT NOT NULL DEFAULT 0,
  `maxDiscount` INT NULL,
  `usageLimit` INT NULL,
  `usageCount` INT NOT NULL DEFAULT 0,
  `startsAt` TIMESTAMP NULL,
  `expiresAt` TIMESTAMP NULL,
  `active` BOOLEAN NOT NULL DEFAULT TRUE,
  `createdAt` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupons_code_unique` (`code`)
);

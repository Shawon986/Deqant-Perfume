-- Associate new orders with the verified application user.
-- Existing guest orders remain guest orders (NULL customerUserId).
ALTER TABLE `orders`
  ADD COLUMN `customerUserId` BIGINT UNSIGNED NULL;

CREATE INDEX `orders_customer_user_idx`
  ON `orders` (`customerUserId`);

ALTER TABLE `orders`
  ADD CONSTRAINT `orders_customer_user_fk`
  FOREIGN KEY (`customerUserId`) REFERENCES `users` (`id`)
  ON DELETE SET NULL;

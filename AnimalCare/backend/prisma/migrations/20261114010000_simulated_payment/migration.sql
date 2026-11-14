-- AlterTable
ALTER TABLE `Appointment` ADD COLUMN `paidAmount` DECIMAL(10, 2) NULL,
    ADD COLUMN `paidAt` DATETIME(3) NULL,
    ADD COLUMN `paymentRef` VARCHAR(191) NULL,
    ADD COLUMN `refundedAt` DATETIME(3) NULL;


-- AlterTable
ALTER TABLE `MedicalRecord` ADD COLUMN `followUpDate` DATETIME(3) NULL,
    ADD COLUMN `followUpReminderSentAt` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `Pet` ADD COLUMN `allergies` TEXT NULL,
    ADD COLUMN `breed` VARCHAR(191) NULL,
    ADD COLUMN `color` VARCHAR(191) NULL,
    ADD COLUMN `microchip` VARCHAR(191) NULL,
    ADD COLUMN `sterilized` BOOLEAN NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `privacyVersion` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `Vaccination` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `appliedAt` DATETIME(3) NOT NULL,
    `nextDueAt` DATETIME(3) NULL,
    `lot` VARCHAR(191) NULL,
    `reminderSentAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `petId` INTEGER NOT NULL,
    `vetProfileId` INTEGER NOT NULL,
    `recordId` INTEGER NULL,

    INDEX `Vaccination_petId_appliedAt_idx`(`petId`, `appliedAt`),
    INDEX `Vaccination_nextDueAt_idx`(`nextDueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Prescription` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `medication` VARCHAR(191) NOT NULL,
    `dose` VARCHAR(191) NOT NULL,
    `frequency` VARCHAR(191) NOT NULL,
    `duration` VARCHAR(191) NULL,
    `instructions` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recordId` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AuditLog` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `action` VARCHAR(191) NOT NULL,
    `actorId` INTEGER NULL,
    `actorName` VARCHAR(191) NULL,
    `actorRole` VARCHAR(191) NULL,
    `entityType` VARCHAR(191) NULL,
    `entityId` INTEGER NULL,
    `petId` INTEGER NULL,
    `ownerId` INTEGER NULL,
    `ip` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AuditLog_petId_createdAt_idx`(`petId`, `createdAt`),
    INDEX `AuditLog_ownerId_createdAt_idx`(`ownerId`, `createdAt`),
    INDEX `AuditLog_actorId_createdAt_idx`(`actorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `Pet_microchip_key` ON `Pet`(`microchip`);

-- AddForeignKey
ALTER TABLE `Vaccination` ADD CONSTRAINT `Vaccination_petId_fkey` FOREIGN KEY (`petId`) REFERENCES `Pet`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vaccination` ADD CONSTRAINT `Vaccination_vetProfileId_fkey` FOREIGN KEY (`vetProfileId`) REFERENCES `VetProfile`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Vaccination` ADD CONSTRAINT `Vaccination_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `MedicalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Prescription` ADD CONSTRAINT `Prescription_recordId_fkey` FOREIGN KEY (`recordId`) REFERENCES `MedicalRecord`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;


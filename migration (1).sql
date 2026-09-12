-- AlterEnum
ALTER TYPE "ProposalStatus" ADD VALUE 'CHANGES_REQUESTED';
ALTER TYPE "NotificationType" ADD VALUE 'COUNTERSIGNED';
ALTER TYPE "NotificationType" ADD VALUE 'DECLINED';
ALTER TYPE "NotificationType" ADD VALUE 'CHANGES_REQUESTED';

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'REP');
CREATE TYPE "SignerRole" AS ENUM ('CLIENT', 'COUNTERSIGNER');
CREATE TYPE "FeedbackType" AS ENUM ('DECLINED', 'CHANGES_REQUESTED');

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "declinedStageId" TEXT,
    ADD COLUMN "requireCounterSign" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "timelineTemplates" JSONB;

ALTER TABLE "User" ADD COLUMN "role" "UserRole" NOT NULL DEFAULT 'REP';

ALTER TABLE "Proposal" ADD COLUMN "counterSignedAt" TIMESTAMP(3),
    ADD COLUMN "declinedAt" TIMESTAMP(3);

ALTER TABLE "Signature" ADD COLUMN "role" "SignerRole" NOT NULL DEFAULT 'CLIENT',
    ADD COLUMN "userId" TEXT;

-- CreateTable
CREATE TABLE "TemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "blocks" JSONB NOT NULL,
    "theme" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplateVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProposalFeedback" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "type" "FeedbackType" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProposalFeedback_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TemplateVersion_templateId_createdAt_idx" ON "TemplateVersion"("templateId", "createdAt");
CREATE INDEX "ProposalFeedback_proposalId_createdAt_idx" ON "ProposalFeedback"("proposalId", "createdAt");
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "Template"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TemplateVersion" ADD CONSTRAINT "TemplateVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProposalFeedback" ADD CONSTRAINT "ProposalFeedback_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Signature" ADD CONSTRAINT "Signature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

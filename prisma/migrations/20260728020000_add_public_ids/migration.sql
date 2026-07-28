-- AddColumn publicId to User (FLS- IDs — "ID da Conta")
ALTER TABLE "User" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "User_publicId_key" ON "User"("publicId");

-- AddColumn publicId to Workspace (WKS- IDs)
ALTER TABLE "Workspace" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "Workspace_publicId_key" ON "Workspace"("publicId");

-- AddColumn publicId to SupportTicket (SUP- IDs)
ALTER TABLE "SupportTicket" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "SupportTicket_publicId_key" ON "SupportTicket"("publicId");

-- AddColumn publicId to TeamMember (INV- IDs)
ALTER TABLE "TeamMember" ADD COLUMN "publicId" TEXT;
CREATE UNIQUE INDEX "TeamMember_publicId_key" ON "TeamMember"("publicId");

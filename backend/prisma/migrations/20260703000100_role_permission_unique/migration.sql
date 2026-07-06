-- Prevent duplicated permission assignments per role.
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_permissionId_key" UNIQUE ("roleId", "permissionId");

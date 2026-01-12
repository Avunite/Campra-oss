export class oauth21714346012345 {
    async up(queryRunner) {
        // Add OAuth2-specific fields to the App entity
        await queryRunner.query(`ALTER TABLE "app" ADD "redirectUris" character varying(512) array NOT NULL DEFAULT '{}'::varchar[]`, undefined);
        await queryRunner.query(`ALTER TABLE "app" ADD "oauth2" boolean NOT NULL DEFAULT false`, undefined);
        
        // Add OAuth2-specific fields to the AccessToken entity
        await queryRunner.query(`ALTER TABLE "access_token" ADD "scope" character varying(64) array NOT NULL DEFAULT '{}'::varchar[]`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" ADD "refreshToken" character varying(128) DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" ADD "expiresAt" TIMESTAMP WITH TIME ZONE DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" ADD "isRefreshToken" boolean NOT NULL DEFAULT false`, undefined);
        
        // Add OAuth2-specific fields to the AuthSession entity
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "redirectUri" character varying(512) DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "codeChallenge" character varying(128) DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "codeChallengeMethod" character varying(10) DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "scope" character varying(64) array NOT NULL DEFAULT '{}'::varchar[]`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "authorizationCode" character varying(128) DEFAULT null`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" ADD "authorizationCodeExpiresAt" TIMESTAMP WITH TIME ZONE DEFAULT null`, undefined);
    }

    async down(queryRunner) {
        // Remove OAuth2-specific fields from the App entity
        await queryRunner.query(`ALTER TABLE "app" DROP COLUMN "redirectUris"`, undefined);
        await queryRunner.query(`ALTER TABLE "app" DROP COLUMN "oauth2"`, undefined);
        
        // Remove OAuth2-specific fields from the AccessToken entity
        await queryRunner.query(`ALTER TABLE "access_token" DROP COLUMN "scope"`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" DROP COLUMN "refreshToken"`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" DROP COLUMN "expiresAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "access_token" DROP COLUMN "isRefreshToken"`, undefined);
        
        // Remove OAuth2-specific fields from the AuthSession entity
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "redirectUri"`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "codeChallenge"`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "codeChallengeMethod"`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "scope"`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "authorizationCode"`, undefined);
        await queryRunner.query(`ALTER TABLE "auth_session" DROP COLUMN "authorizationCodeExpiresAt"`, undefined);
    }
}

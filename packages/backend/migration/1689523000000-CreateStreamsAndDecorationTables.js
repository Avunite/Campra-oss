export class CreateStreamsAndDecorationTables1689523000000 {
    async up(queryRunner) {
        // Create Streams table
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "streams" ("id" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "title" character varying(128) NOT NULL, "key" character varying(512), "userId" character varying(32) NOT NULL, "url" character varying(512) DEFAULT '', "playbackId" character varying(512) DEFAULT '', "noteId" character varying(512) DEFAULT '', CONSTRAINT "PK_stream_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_streams_userId" ON "streams" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_streams_title" ON "streams" ("title") `);
        await queryRunner.query(`ALTER TABLE "streams" ADD CONSTRAINT "FK_streams_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        
        // Create Decoration table
        await queryRunner.query(`CREATE TABLE IF NOT EXISTS "decoration" ("id" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "name" character varying(128) NOT NULL, "credit" character varying(128) NOT NULL, "host" character varying(128), "category" character varying(128), "originalUrl" character varying(512) NOT NULL, "publicUrl" character varying(512) DEFAULT '', "uri" character varying(512), "type" character varying(64), "aliases" character varying(128) array NOT NULL DEFAULT '{}'::varchar[], "isPlus" boolean NOT NULL DEFAULT false, "isMPlus" boolean NOT NULL DEFAULT false, CONSTRAINT "PK_decoration_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_decoration_name" ON "decoration" ("name") `);
        await queryRunner.query(`CREATE INDEX "IDX_decoration_credit" ON "decoration" ("credit") `);
        await queryRunner.query(`CREATE INDEX "IDX_decoration_host" ON "decoration" ("host") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_decoration_name_host" ON "decoration" ("name", "host") `);
        
        // Add isLive column to user table if it doesn't exist
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'isLive'
            ) THEN 
                ALTER TABLE "user" ADD COLUMN "isLive" boolean NOT NULL DEFAULT false;
            END IF;
        END $$;`);
        
        // Add liveUrl column to user table if it doesn't exist
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'liveUrl'
            ) THEN 
                ALTER TABLE "user" ADD COLUMN "liveUrl" character varying(512);
                CREATE INDEX "IDX_user_liveUrl" ON "user" ("liveUrl");
            END IF;
        END $$;`);
        
        // Add avatarDecorations column to user table if it doesn't exist
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'avatarDecorations'
            ) THEN 
                ALTER TABLE "user" ADD COLUMN "avatarDecorations" jsonb DEFAULT '[]'::jsonb;
            END IF;
        END $$;`);
    }

    async down(queryRunner) {
        // Drop Streams table
        await queryRunner.query(`ALTER TABLE "streams" DROP CONSTRAINT IF EXISTS "FK_streams_userId"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_title"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_userId"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "streams"`);
        
        // Drop Decoration table
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_decoration_name_host"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_decoration_host"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_decoration_credit"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "IDX_decoration_name"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "decoration"`);
        
        // Drop added columns from user table (if they exist)
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'isLive'
            ) THEN 
                ALTER TABLE "user" DROP COLUMN "isLive";
            END IF;
        END $$;`);
        
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'liveUrl'
            ) THEN 
                DROP INDEX IF EXISTS "IDX_user_liveUrl";
                ALTER TABLE "user" DROP COLUMN "liveUrl";
            END IF;
        END $$;`);
        
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'avatarDecorations'
            ) THEN 
                ALTER TABLE "user" DROP COLUMN "avatarDecorations";
            END IF;
        END $$;`);
    }
}
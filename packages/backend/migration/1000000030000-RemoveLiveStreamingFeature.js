export class RemoveLiveStreamingFeature1000000030000 {
    name = 'RemoveLiveStreamingFeature1000000030000'

    async up(queryRunner) {
        // Check if streams table exists before trying to modify it
        const streamsTableExists = await queryRunner.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'streams'
            );
        `);
        
        if (streamsTableExists[0].exists) {
            // Remove foreign key constraint for streams table
            await queryRunner.query(`ALTER TABLE "streams" DROP CONSTRAINT IF EXISTS "FK_streams_userId"`);
            
            // Drop indexes for streams table
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_title"`);
            await queryRunner.query(`DROP INDEX IF EXISTS "IDX_streams_userId"`);
            
            // Drop streams table
            await queryRunner.query(`DROP TABLE "streams"`);
        }
        
        // Remove live-related columns from user table
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
    }

    async down(queryRunner) {
        // Recreate streams table
        await queryRunner.query(`CREATE TABLE "streams" ("id" character varying(32) NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE, "title" character varying(128) NOT NULL, "key" character varying(512), "userId" character varying(32) NOT NULL, "url" character varying(512) DEFAULT '', "playbackId" character varying(512) DEFAULT '', "noteId" character varying(512) DEFAULT '', CONSTRAINT "PK_stream_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_streams_userId" ON "streams" ("userId")`);
        await queryRunner.query(`CREATE INDEX "IDX_streams_title" ON "streams" ("title")`);
        await queryRunner.query(`ALTER TABLE "streams" ADD CONSTRAINT "FK_streams_userId" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        
        // Recreate isLive column
        await queryRunner.query(`DO $$ 
        BEGIN 
            IF NOT EXISTS (
                SELECT FROM information_schema.columns 
                WHERE table_name = 'user' AND column_name = 'isLive'
            ) THEN 
                ALTER TABLE "user" ADD COLUMN "isLive" boolean NOT NULL DEFAULT false;
            END IF;
        END $$;`);
        
        // Recreate liveUrl column
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
    }
}

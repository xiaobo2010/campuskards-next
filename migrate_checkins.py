import asyncio
from app.core.database import engine
from sqlalchemy import text

async def migrate():
    async with engine.begin() as conn:
        # Check if table exists
        result = await conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'user_checkins')"))
        exists = result.scalar()
        
        if not exists:
            await conn.execute(text("""
                CREATE TABLE user_checkins (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(64) NOT NULL,
                    checkin_date DATE NOT NULL DEFAULT CURRENT_DATE,
                    streak INTEGER NOT NULL DEFAULT 1,
                    UNIQUE(user_id, checkin_date)
                )
            """))
            print("✅ user_checkins table created")
        else:
            print("✅ user_checkins table already exists")

asyncio.run(migrate())

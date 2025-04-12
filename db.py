# db.py1
import pymysql
import bcrypt
from aiohttp import web
from aiohttp_session import get_session
import os
def get_connection():
    return pymysql.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        user=os.getenv("DB_USER"),
        password=os.getenv("DB_PASSWORD"),
        database=os.getenv("DB_NAME"),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
)


async def register(request):
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    confirm_password = data.get("confirm_password")
    name = data.get("name")
    role = data.get("role")

    if password != confirm_password:
        return web.json_response({"success": False, "message": "Passwords do not match"})

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            sql = "INSERT INTO users (username, password, name, role) VALUES (%s, %s, %s, %s)"
            cursor.execute(sql, (username, hashed, name, role))
            user_id = conn.insert_id()

            if role == "student":
                gender = data.get("gender")
                age = data.get("age")
                level = data.get("level")
                sql2 = "INSERT INTO student_info (user_id, gender, age, level) VALUES (%s, %s, %s, %s)"
                cursor.execute(sql2, (user_id, gender, age, level))

        conn.commit()
        return web.json_response({"success": True, "message": "注册成功"})
    except Exception as e:
        return web.json_response({"success": False, "message": f"注册失败: {str(e)}"})
    finally:
        conn.close()


async def login(request):
    data = await request.json()
    username = data.get("username")
    password = data.get("password")
    session = await get_session(request)
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT * FROM users WHERE username = %s", (username,))
            user = cursor.fetchone()
            if user and bcrypt.checkpw(password.encode("utf-8"), user["password"].encode("utf-8")):
                session["user_id"] = user["id"] #session
                return web.json_response({"success": True, "message": "Login success", "role": user["role"]})
            else:
                return web.json_response({"success": False, "message": "wrong username or password"})
    except Exception as e:
        return web.json_response({"success": False, "message": f"Login failed: {str(e)}"})
    finally:
        conn.close()


def init_db():
    conn = None
    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            # Create users table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(100) UNIQUE NOT NULL,
                    password VARCHAR(255) NOT NULL,
                    name VARCHAR(100),
                    role ENUM('student', 'teacher') NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                );
            """)

            # Create student_info table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS student_info (
                    user_id INT PRIMARY KEY,
                    gender ENUM('male', 'female'),
                    age INT,
                    level ENUM('primary', 'middle', 'high', 'university'),
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                );
            """)

        conn.commit()
        print("Database initialized (tables created if not exist)")
    except Exception as e:
        print(f"Database initialization failed: {e}")
    finally:
        conn.close()

# user_profile.py
from aiohttp import web
from db import get_connection
from aiohttp_session import get_session
import json
def default_background_skin_state():
    return [True] + [False] * 9
def default_fish_skin_state():
    return [True] + [False] * 16
async def get_profile(request):
    session = await get_session(request)
    user_id = session.get("user_id")
    if not user_id:
        return web.json_response({"success": False, "message": "Not logged in"})

    try:
        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT name, role FROM users WHERE id = %s", (user_id,))
            user = cursor.fetchone()

            profile = {
                "name": user["name"],
                "role": user["role"]
            }

            if user["role"] == "student":
                cursor.execute("SELECT gender, age, level, unlocked_backgrounds, unlocked_fish_skins FROM student_info WHERE user_id = %s", (user_id,))
                student = cursor.fetchone()
                if student:
                    profile.update({
                        "gender": student["gender"],
                        "age": student["age"],
                        "level": student["level"],
                        "unlocked_backgrounds": json.loads(student["unlocked_backgrounds"]) if student["unlocked_backgrounds"] else default_background_skin_state(),
                        "unlocked_fish_skins": json.loads(student["unlocked_fish_skins"]) if student["unlocked_fish_skins"] else default_fish_skin_state()
                    })

        return web.json_response({"success": True, "profile": profile})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})
    finally:
        conn.close()

async def update_profile(request):
    session = await get_session(request)
    user_id = session.get("user_id")
    if not user_id:
        return web.json_response({"success": False, "message": "Not logged in"})

    try:
        data = await request.json()
        field = data.get("field")
        value = data.get("value")
        allowed_user_fields = ["name"]
        allowed_student_fields = ["gender", "age", "level", "unlocked_backgrounds", "unlocked_fish_skins"]
        if field not in allowed_user_fields + allowed_student_fields:
            return web.json_response({"success": False, "message": "Invalid field"})

        conn = get_connection()
        with conn.cursor() as cursor:
            cursor.execute("SELECT role FROM users WHERE id = %s", (user_id,))
            result = cursor.fetchone()
            if not result:
                return web.json_response({"success": False, "message": "User not found"})
            role = result["role"]

            if field in allowed_user_fields:
                cursor.execute("UPDATE users SET {} = %s WHERE id = %s".format(field), (value, user_id))

            elif field in allowed_student_fields:
                if role != "student":
                    return web.json_response({"success": False, "message": "Only students can update this field"})
                if field in ["unlocked_backgrounds", "unlocked_fish_skins"]:
                    value = json.dumps(value)
                cursor.execute("UPDATE student_info SET {} = %s WHERE user_id = %s".format(field), (value, user_id))
        conn.commit()
        return web.json_response({"success": True})
    except Exception as e:
        return web.json_response({"success": False, "message": str(e)})
    finally:
        conn.close()

async def logout(request):
    session = await get_session(request)
    session.invalidate()
    return web.json_response({"success": True, "message": "Logged out"})

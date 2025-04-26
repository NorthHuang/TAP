import aiohttp
import aiohttp.web
import os
import json
import pandas as pd
import fitz  # pymupdf
from PIL import Image
import pytesseract
from aiohttp import web
from db import get_connection
import re


UPLOAD_FOLDER = "uploads"
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
ALLOWED_EXTENSIONS = {'.pdf', '.csv', '.txt', '.png', '.jpg', '.jpeg'}

async def upload_file(request):
    reader = await request.multipart()
    field = await reader.next()
    if not field:
        return web.json_response({"success": False, "message": "No file uploaded"})

    filename = field.filename
    if not filename:
        return web.json_response({"success": False, "message": "Filename missing"})

    _, ext = os.path.splitext(filename.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return web.json_response({"success": False, "message": f"Unsupported file type: {ext}"})

    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    save_path = os.path.join(UPLOAD_FOLDER, filename)

    size = 0
    try:
        with open(save_path, 'wb') as f:
            while True:
                chunk = await field.read_chunk()
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_FILE_SIZE:
                    f.close()
                    os.remove(save_path)
                    return web.json_response({"success": False, "message": "File too large (max 5MB)"})
                f.write(chunk)
    except Exception as e:
        return web.json_response({"success": False, "message": f"Failed to save file: {str(e)}"})

    # 新逻辑：本地提取文本
    try:
        extracted_data = await extract_text_and_parse(save_path)
        print("🧹 本地提取到内容：", extracted_data)
        await save_to_database(extracted_data)
        return web.json_response({"success": True, "message": "File uploaded and questions saved"})
    except Exception as e:
        print(f"[⚠️ 提取失败但文件已保存] {str(e)}")
        return web.json_response({"success": True, "message": f"File uploaded but analysis failed: {str(e)}"})

async def extract_text_and_parse(filepath):
    ext = os.path.splitext(filepath)[1].lower()

    text = ""
    if ext == ".pdf":
        text = extract_text_from_pdf(filepath)
        return parse_questions_pdf(text)
    elif ext == ".csv":
        return parse_questions_csv(filepath)
    elif ext in [".png", ".jpg", ".jpeg"]:
        text = extract_text_from_image(filepath)
        return parse_questions_image(text)
    else:
        with open(filepath, "r", encoding="utf-8") as f:
            text = f.read()
            return parse_questions_text(text)


def extract_text_from_pdf(file_path):
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text

def extract_text_from_csv(file_path):
    df = pd.read_csv(file_path)
    return "\n".join(df.apply(lambda row: " ".join(map(str, row)), axis=1))

def extract_text_from_image(file_path):
    img = Image.open(file_path)
    return pytesseract.image_to_string(img, lang='eng')


def parse_questions_text(text):
    questions = []
    lines = text.splitlines()
    current_question = {"description": "", "options": [], "answer": ""}
    option_pattern = re.compile(r"([A-D])\.\s*(.*?)($|(?=[A-D]\.))")  

    for line in lines:
        line = line.strip()
        if not line:
            continue

        matches = list(option_pattern.finditer(line))
        if matches:
            if current_question["description"]:
                questions.append(current_question)
                current_question = {"description": "", "options": [], "answer": ""}

            #直接取第一个选项在行里的位置
            first_option_pos = matches[0].start()
            description = line[:first_option_pos].strip()
            current_question["description"] = description

            for match in matches:
                letter = match.group(1)
                option_text = match.group(2).strip()
                current_question["options"].append(f"{letter}. {option_text}")
            continue

        # 单独一行选项
        if len(line) >= 2 and line[0] in "ABCD" and line[1] == '.':
            current_question["options"].append(line)
        # 答案
        elif line.lower().startswith("answer") or line.lower().startswith("答案"):
            parts = line.split(":")
            if len(parts) > 1:
                current_question["answer"] = parts[1].strip().upper()
        else:
            if current_question["description"]:
                questions.append(current_question)
                current_question = {"description": "", "options": [], "answer": ""}
            current_question["description"] = line

    if current_question["description"]:
        questions.append(current_question)

    return questions

async def upload_text(request):
    data = await request.json()
    text = data.get("text", "")
    if not text.strip():
        return web.json_response({"success": False, "message": "No text provided"})

    try:
        questions = parse_questions_text(text)
        await save_to_database(questions)
        return web.json_response({"success": True, "message": "Text processed and questions saved"})
    except Exception as e:
        return web.json_response({"success": False, "message": f"Failed to process text: {str(e)}"})

async def save_to_database(questions):
    if not questions:
        return
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            for q in questions:
                sql = """
                    INSERT INTO questions (
                        description, subject, education_level, options, answer, explanation, difficulty, created_by
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                cursor.execute(sql, (
                    q.get('description') or "未知题目",
                    q.get('subject') or "English",
                    q.get('education_level') or "University",
                    json.dumps(q.get('options') or []),
                    q.get('answer') or "A",
                    q.get('explanation') or "",
                    q.get('difficulty') or "medium",
                    "upload"
                ))
        conn.commit()
    finally:
        conn.close()

def parse_questions_csv(file_path):
    questions = []
    df = pd.read_csv(file_path)

    for _, row in df.iterrows():
        description = row.get("description") or row.get("题目") or ""
        answer = (row.get("answer") or row.get("正确答案") or "").strip().upper()

        options = []

        if all(col in row for col in ["A", "B", "C", "D"]):
            # 如果A/B/C/D独立列存在
            for option_letter in ["A", "B", "C", "D"]:
                option_text = row.get(option_letter)
                if pd.notna(option_text) and str(option_text).strip():
                    options.append(f"{option_letter}. {option_text.strip()}")
        elif "options" in row and pd.notna(row["options"]):
            # 如果只有整体 options 字段（json数组）
            try:
                loaded_options = json.loads(row["options"])
                if isinstance(loaded_options, list):
                    options = loaded_options
            except Exception as e:
                print(f"options字段解析失败：{e}")

        if description and options:
            questions.append({
                "description": description,
                "options": options,
                "answer": answer
            })

    return questions

def parse_questions_image(text):
    questions = []
    lines = text.splitlines()

    option_pattern = re.compile(r"^[A-D][\.\,\、\)]\s*(.+)")
    current_question = None
    is_reading_options = False

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # 是选项行
        if option_pattern.match(line):
            if current_question is None:
                current_question = {"description": "Unknown question", "options": [], "answer": ""}
            current_question["options"].append(line)
            is_reading_options = True
            continue

        # 是答案行
        if line.lower().startswith("answer") or line.lower().startswith("答案"):
            if current_question:
                parts = line.split(":")
                if len(parts) > 1:
                    current_question["answer"] = parts[1].strip().upper()
            continue

        # 其他普通行（可能是题干，也可能是补充）
        if current_question and is_reading_options:
            # 判断当前行是不是疑似补充
            if len(line) < 20 and not option_pattern.match(line):
                # 短行 + 不是选项：认定为上一题的补充题干
                current_question["description"] += " " + line
            else:
                # 否则就正常开启新的一题
                questions.append(current_question)
                current_question = {"description": line, "options": [], "answer": ""}
                is_reading_options = False
        else:
            if current_question is None:
                current_question = {"description": line, "options": [], "answer": ""}
            else:
                current_question["description"] += " " + line

    if current_question:
        questions.append(current_question)

    return questions

def parse_questions_pdf(text):
    # 用图片那一套
    return parse_questions_image(text)

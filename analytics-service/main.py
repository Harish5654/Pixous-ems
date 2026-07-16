import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import mysql.connector
from datetime import datetime, timedelta
from typing import List, Dict, Any
from fastapi import File, UploadFile, HTTPException
import numpy as np
import face_recognition
from PIL import Image, ImageOps
import re
import easyocr
import pytesseract
import cv2

FACES_DIR = "faces"
if not os.path.exists(FACES_DIR):
    os.makedirs(FACES_DIR)

# Initialize EasyOCR reader once globally so it doesn't reload the model on every request
# We use gpu=False as default to avoid issues unless CUDA is perfectly configured
try:
    ocr_reader = easyocr.Reader(['en'], gpu=False)
except Exception as e:
    print("Failed to initialize EasyOCR:", e)
    ocr_reader = None

app = FastAPI(title="HR Analytics Service")

# Allow requests from the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5174", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db_connection():
    try:
        return mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", "root123"),
            database=os.getenv("DB_NAME", "hr")
        )
    except mysql.connector.Error as err:
        print(f"Error: {err}")
        raise HTTPException(status_code=500, detail="Database connection failed")

@app.get("/")
def read_root():
    return {"message": "HR Analytics API is running"}

@app.get("/api/analytics/employee/{user_id}")
def get_employee_analytics(user_id: int):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # 1. Weekly Work Hours Trend (Last 7 Days)
        cursor.execute("""
            SELECT work_date, worked_minutes 
            FROM attendance 
            WHERE user_id = %s 
            ORDER BY work_date DESC LIMIT 7
        """, (user_id,))
        recent_attendance = cursor.fetchall()
        
        # Reverse to show chronological order
        recent_attendance.reverse()
        work_hours_trend = [
            {
                "date": rec['work_date'].strftime('%Y-%m-%d') if rec['work_date'] else 'N/A',
                "hours": round((rec['worked_minutes'] or 0) / 60.0, 1)
            }
            for rec in recent_attendance
        ]
        
        # 2. Leave Utilization Prediction
        cursor.execute("""
            SELECT lb.allocated, lb.used, lt.name as leave_type_name
            FROM leave_balances lb
            JOIN leave_types lt ON lb.leave_type_id = lt.id
            WHERE lb.user_id = %s AND lb.year = %s
        """, (user_id, datetime.now().year))
        leave_balances = cursor.fetchall()
        
        high_risk_leaves = []
        for lb in leave_balances:
            if lb['allocated'] > 0:
                utilization_rate = (lb['used'] / lb['allocated']) * 100
                if utilization_rate > 80:
                    high_risk_leaves.append({
                        "name": lb['leave_type_name'],
                        "warning": f"You have used {lb['used']} out of {lb['allocated']} days. Very few remaining."
                    })
                    
        # 3. Overall Attendance Score (Based on late punch-ins vs on-time)
        cursor.execute("""
            SELECT COUNT(*) as total_days, SUM(is_late = 1) as late_days
            FROM attendance 
            WHERE user_id = %s
        """, (user_id,))
        attendance_stats = cursor.fetchone()
        
        punctuality_score = 100
        if attendance_stats and attendance_stats['total_days'] > 0:
            punctuality_score = round(
                100 - ((attendance_stats['late_days'] / attendance_stats['total_days']) * 100)
            )

        return {
            "success": True,
            "data": {
                "workHoursTrend": work_hours_trend,
                "highRiskLeaves": high_risk_leaves,
                "punctualityScore": punctuality_score,
                "insight": f"Your punctuality score is {punctuality_score}%. " + 
                           ("Keep up the great work!" if punctuality_score >= 90 else "Try to arrive on time more often.")
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.get("/api/analytics/executive")
def get_executive_analytics(industry: str = "ALL"):
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        # Get list of unique departments
        cursor.execute("SELECT DISTINCT department FROM users WHERE department IS NOT NULL")
        depts = [r['department'] for r in cursor.fetchall()]
        
        dept_analytics = []
        for dept in depts:
            query = """
                SELECT COUNT(*) as total, SUM(is_late = 1) as late, SUM(status = 'PRESENT' OR status = 'WFH') as present
                FROM attendance a
                JOIN users u ON a.user_id = u.id
                WHERE u.department = %s
            """
            params = [dept]
            if industry != "ALL":
                query += " AND u.industry = %s"
                params.append(industry)
                
            cursor.execute(query, tuple(params))
            stats = cursor.fetchone()
            if stats and stats['total'] > 0:
                late_rate = round((stats['late'] / stats['total']) * 100)
                present_rate = round((stats['present'] / stats['total']) * 100)
                dept_analytics.append({
                    "department": dept,
                    "lateRate": late_rate,
                    "attendanceRate": present_rate
                })
        
        query_total = "SELECT COUNT(*) as total FROM users"
        params_total = []
        if industry != "ALL":
            query_total += " WHERE industry = %s"
            params_total.append(industry)
            
        cursor.execute(query_total, tuple(params_total))
        total_users = cursor.fetchone()['total']
        
        insight = f"Organization analytics computed for {total_users} active employees."
        if industry != "ALL":
            insight += f" Filtered by {'Digital' if industry == 'IT' else 'Infra'} team."
        else:
            insight += " Overview of all Digital and Infra segments."
            
        return {
            "success": True,
            "data": {
                "departmentStats": dept_analytics,
                "insight": insight
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@app.post("/api/face/train/{user_id}")
async def train_face(user_id: int, file: UploadFile = File(...)):
    try:
        image = face_recognition.load_image_file(file.file)
        face_encodings = face_recognition.face_encodings(image)
        
        if len(face_encodings) == 0:
            raise HTTPException(status_code=400, detail="No face found in the image. Please try again.")
        
        np.save(os.path.join(FACES_DIR, f"{user_id}.npy"), face_encodings[0])
        return {"success": True, "message": "Face trained successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/face/verify/{user_id}")
async def verify_face(user_id: int, file: UploadFile = File(...)):
    try:
        saved_encoding_path = os.path.join(FACES_DIR, f"{user_id}.npy")
        if not os.path.exists(saved_encoding_path):
            raise HTTPException(status_code=400, detail="Face not trained for this user.")
        
        saved_encoding = np.load(saved_encoding_path)
        
        live_image = face_recognition.load_image_file(file.file)
        live_encodings = face_recognition.face_encodings(live_image)
        
        if len(live_encodings) == 0:
            raise HTTPException(status_code=400, detail="No face found in the live camera feed.")
            
        # Compare (tolerance 0.6 is default, 0.5 is a bit more strict)
        matches = face_recognition.compare_faces([saved_encoding], live_encodings[0], tolerance=0.5)
        
        if matches[0]:
            return {"success": True, "match": True, "message": "Face verified successfully"}
        else:
            return {"success": True, "match": False, "message": "Face does not match"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/ocr")
async def extract_number_from_image(file: UploadFile = File(...)):
    try:
        # Load image with PIL to handle EXIF rotation
        image = Image.open(file.file)
        image = ImageOps.exif_transpose(image)
        
        # Convert to numpy array for EasyOCR & OpenCV
        img_array = np.array(image.convert('RGB'))
        gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
        
        candidates = []
        
        # --- METHOD 1: EasyOCR ---
        if ocr_reader is not None:
            try:
                results = ocr_reader.readtext(
                    img_array, 
                    rotation_info=[90, 180, 270],
                    text_threshold=0.5,
                    low_text=0.3,
                    link_threshold=0.6,
                    width_ths=15.0,
                    mag_ratio=1.5
                )
                
                # Sort bounding boxes left-to-right to ensure correct order
                results.sort(key=lambda x: x[0][0][0])
                
                easyocr_digits = ""
                for (bbox, text, prob) in results:
                    text = text.upper()
                    text = text.replace('O', '0').replace('S', '5').replace('Z', '2').replace('B', '8').replace('G', '6')
                    digits_only = re.sub(r'\D', '', text)
                    easyocr_digits += digits_only
                
                if easyocr_digits:
                    candidates.append(easyocr_digits)
            except Exception as e:
                print("EasyOCR failed:", e)

        # --- METHOD 2: Tesseract OCR (with OpenCV preprocessing) ---
        try:
            # Apply Gaussian Blur to reduce noise
            blurred = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Apply Otsu's thresholding
            _, thresh = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Invert the image (odometers are usually white text on black background)
            thresh_inv = cv2.bitwise_not(thresh)
            
            custom_config = r'--oem 3 -c tessedit_char_whitelist=0123456789'
            
            for processed_img in [thresh, thresh_inv]:
                pil_img = Image.fromarray(processed_img)
                
                # Try rotations
                for angle in [0, 90, 180, 270]:
                    rotated = pil_img.rotate(angle, expand=True)
                    
                    # Try different PSM modes
                    for psm in [7, 11, 8, 6]:
                        cfg = f'{custom_config} --psm {psm}'
                        text = pytesseract.image_to_string(rotated, config=cfg)
                        
                        digits_only = re.sub(r'\D', '', text)
                        if digits_only:
                            candidates.append(digits_only)
        except pytesseract.TesseractNotFoundError:
            print("Tesseract not installed, skipping Method 2.")
        except Exception as e:
            print("Tesseract failed:", e)
            
        # --- PICK THE BEST CANDIDATE ---
        # The best candidate is usually the longest digit sequence
        if candidates:
            best_digits = max(candidates, key=len)
            return {"success": True, "value": int(best_digits)}
        else:
            return {"success": False, "message": "Could not confidently read numbers. Please ensure the image is clear."}
    except Exception as e:
        error_msg = str(e)
        raise HTTPException(status_code=500, detail=error_msg)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8082, reload=True)

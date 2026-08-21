import secrets
from flask import Flask
from flask import request, jsonify, send_from_directory, session
from flask_cors import CORS
import sqlite3

app = Flask(__name__)
app.secret_key = secrets.token_hex(32)
CORS(app)
DB = "companydesk.db"

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

@app.route("/")
def home():
    return send_from_directory(".", "index.html")

@app.route("/api/companies", methods=["POST"])
def create_company():
    data = request.get_json()

    name = data.get("name", "").strip()
    manager = data.get("manager", "").strip()
    email = data.get("email", "").strip()

    if not name or not manager or not email:
        return jsonify({"error": "جميع البيانات مطلوبة"}), 400

    try:
        conn = get_db()

        cursor = conn.execute(
            """
            INSERT INTO companies (name, manager, email)
            VALUES (?, ?, ?)
            """,
            (name, manager, email)
        )

        conn.commit()

        company_id = cursor.lastrowid
        conn.close()

        return jsonify({
            "success": True,
            "company_id": company_id
        }), 201

    except sqlite3.IntegrityError:
        return jsonify({
            "error": "هذا البريد الإلكتروني مسجل مسبقًا"
        }), 409

@app.route("/api/employees", methods=["GET"])
def get_employees():
    company_id = request.args.get("company_id")

    conn = get_db()

    rows = conn.execute(
        "SELECT id, company_id, name, department FROM employees WHERE company_id = ?",
        (company_id,)
    ).fetchall()

    conn.close()

    return jsonify({
        "employees": [
            {
                "id": row[0],
                "company_id": row[1],
                "name": row[2],
                "department": row[3]
            }
            for row in rows
        ]
    })

@app.route("/api/employees", methods=["POST"])
def create_employee():

    if session.get("role") != "manager":
        return jsonify({"error": "غير مسموح: هذه العملية للمدير فقط"}), 403

    data = request.get_json() or {}

    company_id = data.get("company_id")
    name = data.get("name", "").strip()
    department = data.get("department", "").strip()

    if not company_id or not name:
        return jsonify({"error": "الشركة واسم الموظف مطلوبان"}), 400

    conn = get_db()

    company = conn.execute(
        "SELECT id FROM companies WHERE id = ?",
        (company_id,)
    ).fetchone()

    if not company:
        conn.close()
        return jsonify({"error": "الشركة غير موجودة"}), 404

    cursor = conn.execute(
        """
        INSERT INTO employees (company_id, name, department)
        VALUES (?, ?, ?)
        """,
        (company_id, name, department)
    )

    conn.commit()
    employee_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "employee_id": employee_id
    }), 201


@app.route("/api/departments", methods=["GET"])
def get_departments():
    company_id = request.args.get("company_id")

    if not company_id:
        return jsonify({"error": "معرف الشركة مطلوب"}), 400

    conn = get_db()

    rows = conn.execute("""
        SELECT id, company_id, name, created_at
        FROM departments
        WHERE company_id = ?
        ORDER BY id DESC
    """, (company_id,)).fetchall()

    conn.close()

    return jsonify({
        "departments": [dict(row) for row in rows]
    })


@app.route("/api/departments", methods=["POST"])
def create_department():

    if session.get("role") != "manager":
        return jsonify({
            "error": "غير مسموح: هذه العملية للمدير فقط"
        }), 403

    data = request.get_json() or {}

    company_id = data.get("company_id")
    name = data.get("name", "").strip()

    if not company_id or not name:
        return jsonify({
            "error": "الشركة واسم القسم مطلوبان"
        }), 400

    conn = get_db()

    company = conn.execute("""
        SELECT id
        FROM companies
        WHERE id = ?
    """, (company_id,)).fetchone()

    if not company:
        conn.close()
        return jsonify({
            "error": "الشركة غير موجودة"
        }), 404

    try:
        cursor = conn.execute("""
            INSERT INTO departments (company_id, name)
            VALUES (?, ?)
        """, (company_id, name))

        conn.commit()

        department_id = cursor.lastrowid

        conn.close()

        return jsonify({
            "success": True,
            "department_id": department_id,
            "name": name
        }), 201

    except sqlite3.IntegrityError:
        conn.close()

        return jsonify({
            "error": "هذا القسم موجود مسبقًا"
        }), 409


@app.route("/api/departments/<int:department_id>", methods=["DELETE"])
def delete_department(department_id):

    if session.get("role") != "manager":
        return jsonify({
            "error": "غير مسموح: هذه العملية للمدير فقط"
        }), 403

    company_id = session.get("company_id")

    conn = get_db()

    department = conn.execute("""
        SELECT id
        FROM departments
        WHERE id = ? AND company_id = ?
    """, (department_id, company_id)).fetchone()

    if not department:
        conn.close()
        return jsonify({
            "error": "القسم غير موجود"
        }), 404

    conn.execute("""
        DELETE FROM departments
        WHERE id = ? AND company_id = ?
    """, (department_id, company_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "department_id": department_id
    })


@app.route("/api/change-password", methods=["POST"])
def change_password():
    data = request.get_json() or {}

    user_id = data.get("user_id")
    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not user_id or not current_password or not new_password:
        return jsonify({"error": "جميع الحقول مطلوبة"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "كلمة المرور الجديدة يجب أن تكون 8 أحرف على الأقل"}), 400

    conn = get_db()

    user = conn.execute(
        "SELECT id, password_hash FROM users WHERE id = ?",
        (user_id,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "المستخدم غير موجود"}), 404

    from werkzeug.security import check_password_hash, generate_password_hash

    if not check_password_hash(user["password_hash"], current_password):
        conn.close()
        return jsonify({"error": "كلمة المرور الحالية غير صحيحة"}), 401

    new_hash = generate_password_hash(new_password)

    conn.execute(
        "UPDATE users SET password_hash = ? WHERE id = ?",
        (new_hash, user_id)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": "تم تغيير كلمة المرور بنجاح"})



@app.route("/api/tickets", methods=["GET"])
def get_tickets():
    if not session.get("user_id"):
        return jsonify({"error": "يجب تسجيل الدخول أولًا"}), 401

    company_id = session.get("company_id")

    conn = get_db()

    if session.get("role") == "employee":
        rows = conn.execute("""
            SELECT
                tickets.id,
                tickets.company_id,
                tickets.title,
                tickets.description,
                tickets.location,
                tickets.priority,
                tickets.status,
                tickets.employee_id,
                employees.name AS employee_name,
                tickets.notes,
                tickets.created_at
            FROM tickets
            LEFT JOIN employees ON tickets.employee_id = employees.id
            WHERE tickets.company_id = ?
              AND tickets.employee_id = ?
            ORDER BY tickets.id DESC
        """, (company_id, session.get("employee_id"))).fetchall()
    else:
        rows = conn.execute("""
            SELECT
                tickets.id,
                tickets.company_id,
                tickets.title,
                tickets.description,
                tickets.location,
                tickets.priority,
                tickets.status,
                tickets.employee_id,
                employees.name AS employee_name,
                tickets.notes,
                tickets.created_at
            FROM tickets
            LEFT JOIN employees ON tickets.employee_id = employees.id
            WHERE tickets.company_id = ?
            ORDER BY tickets.id DESC
        """, (company_id,)).fetchall()

    conn.close()

    return jsonify({
        "tickets": [dict(row) for row in rows]
    })


@app.route("/api/tickets/<int:ticket_id>/assign", methods=["PUT"])
def assign_ticket(ticket_id):
    if not session.get("user_id"):
        return jsonify({"error": "يجب تسجيل الدخول أولًا"}), 401

    if session.get("role") != "manager":
        return jsonify({"error": "غير مسموح"}), 403

    data = request.get_json() or {}
    employee_id = data.get("employee_id")

    if not employee_id:
        return jsonify({"error": "يجب اختيار الموظف"}), 400

    company_id = session.get("company_id")
    conn = get_db()

    employee = conn.execute("""
        SELECT id
        FROM employees
        WHERE id = ? AND company_id = ?
    """, (employee_id, company_id)).fetchone()

    if not employee:
        conn.close()
        return jsonify({"error": "الموظف غير موجود"}), 404

    if session.get("role") == "employee":
        ticket = conn.execute("""
            SELECT id
            FROM tickets
            WHERE id = ?
              AND company_id = ?
              AND employee_id = ?
        """, (
            ticket_id,
            company_id,
            session.get("employee_id")
        )).fetchone()
    else:
        ticket = conn.execute("""
            SELECT id
            FROM tickets
            WHERE id = ? AND company_id = ?
        """, (ticket_id, company_id)).fetchone()

    if not ticket:
        conn.close()
        return jsonify({"error": "الطلب غير موجود"}), 404

    conn.execute("""
        UPDATE tickets
        SET employee_id = ?
        WHERE id = ? AND company_id = ?
    """, (employee_id, ticket_id, company_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "ticket_id": ticket_id,
        "employee_id": employee_id
    })


@app.route("/api/tickets", methods=["POST"])
def create_ticket():
    if not session.get("user_id"):
        return jsonify({"error": "يجب تسجيل الدخول أولًا"}), 401

    data = request.get_json() or {}

    title = data.get("title", "").strip()
    description = data.get("description", "").strip()
    location = data.get("location", "").strip()
    priority = data.get("priority", "medium").strip()
    employee_id = data.get("employee_id")

    if not title:
        return jsonify({"error": "عنوان الطلب مطلوب"}), 400

    if priority not in ("low", "medium", "high"):
        return jsonify({"error": "الأولوية غير صحيحة"}), 400

    company_id = session.get("company_id")

    conn = get_db()

    cursor = conn.execute("""
        INSERT INTO tickets
        (company_id, title, description, location, priority, employee_id)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        company_id,
        title,
        description,
        location,
        priority,
        employee_id
    ))

    conn.commit()
    ticket_id = cursor.lastrowid
    conn.close()

    return jsonify({
        "success": True,
        "ticket_id": ticket_id
    }), 201

@app.route("/api/tickets/<int:ticket_id>/status", methods=["PUT"])
def update_ticket_status(ticket_id):
    if not session.get("user_id"):
        return jsonify({"error": "يجب تسجيل الدخول أولًا"}), 401

    data = request.get_json() or {}
    status = data.get("status", "").strip()

    if status not in ("new", "working", "done"):
        return jsonify({"error": "حالة الطلب غير صحيحة"}), 400

    company_id = session.get("company_id")
    conn = get_db()

    if session.get("role") == "employee":
        ticket = conn.execute("""
            SELECT id
            FROM tickets
            WHERE id = ?
              AND company_id = ?
              AND employee_id = ?
        """, (
            ticket_id,
            company_id,
            session.get("employee_id")
        )).fetchone()
    else:
        ticket = conn.execute("""
            SELECT id
            FROM tickets
            WHERE id = ? AND company_id = ?
        """, (ticket_id, company_id)).fetchone()

    if not ticket:
        conn.close()
        return jsonify({"error": "الطلب غير موجود أو غير مسند إليك"}), 404

    conn.execute("""
        UPDATE tickets
        SET status = ?
        WHERE id = ? AND company_id = ?
    """, (status, ticket_id, company_id))

    conn.commit()
    conn.close()

    return jsonify({
        "success": True,
        "ticket_id": ticket_id,
        "status": status
    })


@app.route("/api/reports", methods=["GET"])
def get_reports():
    if not session.get("user_id"):
        return jsonify({"error": "يجب تسجيل الدخول أولًا"}), 401

    if session.get("role") != "manager":
        return jsonify({"error": "غير مسموح"}), 403

    company_id = session.get("company_id")
    conn = get_db()

    total = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ?",
        (company_id,)
    ).fetchone()[0]

    new_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status = 'new'",
        (company_id,)
    ).fetchone()[0]

    working_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status = 'working'",
        (company_id,)
    ).fetchone()[0]

    done_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND status = 'done'",
        (company_id,)
    ).fetchone()[0]

    low_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND priority = 'low'",
        (company_id,)
    ).fetchone()[0]

    medium_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND priority = 'medium'",
        (company_id,)
    ).fetchone()[0]

    high_count = conn.execute(
        "SELECT COUNT(*) FROM tickets WHERE company_id = ? AND priority = 'high'",
        (company_id,)
    ).fetchone()[0]

    conn.close()

    return jsonify({
        "total": total,
        "new": new_count,
        "working": working_count,
        "done": done_count,
        "low": low_count,
        "medium": medium_count,
        "high": high_count
    })


@app.route("/api/login", methods=["POST"])
def login():
    data = request.get_json() or {}

    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "اسم المستخدم وكلمة المرور مطلوبان"}), 400

    conn = get_db()

    user = conn.execute("""
        SELECT id, company_id, employee_id, username, password_hash, role
        FROM users
        WHERE username = ?
    """, (username,)).fetchone()

    conn.close()

    if not user:
        return jsonify({"error": "بيانات الدخول غير صحيحة"}), 401

    from werkzeug.security import check_password_hash

    if not check_password_hash(user["password_hash"], password):
        return jsonify({"error": "بيانات الدخول غير صحيحة"}), 401

    session["user_id"] = user["id"]
    session["company_id"] = user["company_id"]
    session["employee_id"] = user["employee_id"]
    session["username"] = user["username"]
    session["role"] = user["role"]

    return jsonify({
        "success": True,
        "user_id": user["id"],
        "company_id": user["company_id"],
        "employee_id": user["employee_id"],
        "username": user["username"],
        "role": user["role"]
    })

if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )

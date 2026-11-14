# 🚀 KidSynq SaaS Daycare Management Platform

**KidSynq** is a multi-tenant SaaS daycare management web application built entirely on the **Django MTV (Model–Template–View)** architecture.

---

## 🛠️ Technology Stack

| Layer | Technology |
|---|---|
| **Backend Framework** | Django 5.2 LTS (Python 3.11) |
| **Architecture** | Django MTV (Model–Template–View) |
| **Frontend Templates** | Django Templates with Template Inheritance |
| **UI Framework** | Bootstrap 5.3.3 |
| **Icons** | Bootstrap Icons 1.11.3 |
| **Analytics & Charts** | Chart.js 4.4.2 |
| **Client Scripting** | Vanilla JavaScript (ES6+) |
| **Database** | MySQL |
| **Authentication & RBAC** | Django Authentication + Custom Role-Based Access Controls |
| **Static File Serving** | Django Staticfiles + WhiteNoise |
| **Production Hosting** | GoDaddy cPanel (CloudLinux + Passenger WSGI) |

> **Note:** This application runs entirely within Django without React, Node.js, Express, Vite, npm, or separate frontend servers.

---

## 📁 Project Structure

```
KidSynq/
│
├── backend/
│   │
│   ├── manage.py
│   ├── requirements.txt
│   ├── passenger_wsgi.py
│   ├── .env
│   ├── .env.example
│   ├── .gitignore
│   │
│   ├── kidsynq/                    # Main Django project configuration
│   │   ├── __init__.py
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── wsgi.py
│   │   └── asgi.py
│   │
│   ├── apps/                       # All Django applications
│   │   │
│   │   ├── core/                   # Shared functionality
│   │   │   ├── models.py
│   │   │   ├── views.py
│   │   │   ├── urls.py
│   │   │   ├── forms.py
│   │   │   ├── admin.py
│   │   │   ├── apps.py
│   │   │   ├── permissions.py
│   │   │   ├── middleware.py
│   │   │   ├── auth_backends.py
│   │   │   ├── services/
│   │   │   ├── utils/
│   │   │   ├── tests/
│   │   │   └── migrations/
│   │   │
│   │   ├── superadmin/             # SaaS platform administration
│   │   │   ├── models.py
│   │   │   ├── views/
│   │   │   ├── urls.py
│   │   │   ├── forms/
│   │   │   ├── services/
│   │   │   ├── permissions.py
│   │   │   ├── tests/
│   │   │   └── migrations/
│   │   │
│   │   ├── daycare/                # Daycare management
│   │   │   ├── models.py
│   │   │   ├── views/
│   │   │   ├── urls.py
│   │   │   ├── forms/
│   │   │   ├── services/
│   │   │   ├── permissions.py
│   │   │   ├── tests/
│   │   │   └── migrations/
│   │   │
│   │   ├── children/               # Child/student management
│   │   ├── families/               # Family and guardian management
│   │   ├── staff/                  # Staff management
│   │   ├── classrooms/             # Classroom management
│   │   ├── enrollment/             # Registration and enrollment
│   │   ├── attendance/             # Attendance management
│   │   ├── subscriptions/          # SaaS plans and subscriptions
│   │   ├── billing/                # Invoices and payment records
│   │   ├── payments/               # Payment gateway integration
│   │   ├── reports/                # Reports and analytics
│   │   └── notifications/          # Email and system notifications
│   │
│   ├── templates/                  # Django HTML templates
│   │   ├── base/
│   │   ├── authentication/
│   │   ├── superadmin/
│   │   ├── daycare/
│   │   ├── children/
│   │   ├── families/
│   │   ├── staff/
│   │   ├── classrooms/
│   │   ├── subscriptions/
│   │   └── errors/
│   │
│   ├── static/                     # CSS, JavaScript and images
│   │   ├── css/
│   │   ├── js/
│   │   ├── images/
│   │   └── vendor/
│   │
│   ├── media/                      # User-uploaded documents/images
│   │
│   ├── staticfiles/                # Collected static files
│   │
│   ├── config/                     # Optional environment configurations
│   │
│   └── logs/
│
└── README.md
```

---

## 🏃‍♂️ Getting Started (Local Development)

### Prerequisites
- Python 3.11
- MySQL Server (or XAMPP / MySQL Workbench)

### Setup Instructions

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On Linux/macOS:
   source venv/bin/activate
   ```

3. **Install Python dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure your `.env` file** (in the project root or backend directory):
   ```env
   DB_CONNECTION=mysql
   DB_ENGINE=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=kidsynq
   DB_USERNAME=root
   DB_PASSWORD=your_password
   DEBUG=True
   ```

5. **Apply database migrations:**
   ```bash
   python manage.py migrate
   ```

6. **Collect static files:**
   ```bash
   python manage.py collectstatic --noinput
   ```

7. **Start the local Django server:**
   ```bash
   python manage.py runserver 8000
   ```

   Visit [http://127.0.0.1:8000/login/](http://127.0.0.1:8000/login/) to log in.

---

## 🌐 Production Deployment (GoDaddy cPanel / Passenger WSGI)

1. **cPanel Python App Setup:**
   - In cPanel, navigate to **Setup Python App**.
   - Create or select an application using **Python 3.11**.
   - Set **Application root** to `/home/lqg1ons8pzm4/kidsynq_api` (or your cPanel account path).
   - Set **Application URL** to your domain.

2. **Upload Backend Files:**
   - Deploy the contents of `backend/` into the application root directory.
   - Verify `passenger_wsgi.py` and `.htaccess` are positioned at the root of the Python app.

3. **Install Requirements in cPanel:**
   - Activate the virtualenv in cPanel terminal and run:
     ```bash
     pip install -r requirements.txt
     ```

4. **Collect Static Files:**
   ```bash
   python manage.py collectstatic --noinput
   ```

5. **Restart Python App:**
   - Click **Restart** in cPanel Setup Python App, or touch `tmp/restart.txt`.

---

## 🔒 Modules & Role-Based Access Control

- **Super Admin (`/superadmin/`)**: Platform-wide metrics, daycare tenant onboarding, subscription plans, MRR revenue analytics, audit logs, and support tickets.
- **Daycare Center Admin (`/daycare/`)**: Center operations, classrooms, educator ratios, staff scheduling, timesheets, child records, emergency files, and attendance roll calls.
- **Tuition & Finance (`/daycare/billing/`)**: Invoices, payment receipts, CWELCC subsidies, and CRA annual tax receipts.
- **Family Portal (`/family/`)**: Parent/guardian interface for daily educator reports, meal/nap logs, attendance history, and fee statements.
- **Public Admissions (`/register/<slug>/`)**: Self-service online child registration wizard.

---

## 📄 License
Commercial proprietary software. All rights reserved.

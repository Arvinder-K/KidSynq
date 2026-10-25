# 🚀 KidSynq

Welcome to **KidSynq**! This is a modern full-stack web application built with a powerful backend and a responsive, dynamic frontend.

## 🛠️ Tech Stack

### Frontend
- **Framework:** React 19 + TypeScript
- **Build Tool:** Vite
- **Styling:** TailwindCSS
- **Routing:** React Router DOM
- **Data Fetching:** React Query
- **Charts:** Chart.js + react-chartjs-2
- **Icons:** Lucide React
- **Animations:** Framer Motion

### Backend
- **Framework:** Django (Python)
- **Database:** MySQL (Configured via `settings.py` & `.env`)

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- MySQL Server (or XAMPP / WAMP / MySQL Workbench)

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies (including MySQL driver `pymysql` / `mysqlclient`):
   ```bash
   pip install -r requirements.txt
   ```
4. Create the MySQL database:
   ```sql
   CREATE DATABASE kidsynq CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
5. Configure database credentials in `.env`:
   ```env
   DB_CONNECTION=mysql
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=kidsynq
   DB_USERNAME=root
   DB_PASSWORD=your_mysql_password
   ```
6. Run database migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the Django development server:
   ```bash
   python manage.py runserver 8000
   ```

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   The frontend will typically run on `http://localhost:5173`.

## 🤝 Contributing
Contributions are always welcome! Feel free to open an issue or submit a pull request.

## 📄 License
This project is open-sourced software licensed under the MIT license.

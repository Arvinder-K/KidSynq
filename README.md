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
- **Database:** PostgreSQL (Configured via `settings.py`)

## 🏃‍♂️ Getting Started

### Prerequisites
- Node.js (v18+)
- Python (3.10+)
- PostgreSQL

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows
   # or source venv/bin/activate # On macOS/Linux
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up the PostgreSQL database (`kidsynq`) and run migrations:
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

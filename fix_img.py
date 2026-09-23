import os

file_path = 'frontend/src/pages/students/StudentProfileLayout.tsx'
with open(file_path, 'r') as f:
    content = f.read()

content = content.replace("import api from '../../api';", "import api, { BACKEND_URL } from '../../api';")
content = content.replace('import api from "../../api";', 'import api, { BACKEND_URL } from "../../api";')
content = content.replace('<img src={student.photo}', '<img src={getImageUrl(student.photo)}')

with open(file_path, 'w') as f:
    f.write(content)

print("Done")

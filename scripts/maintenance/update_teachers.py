import os
import django
from datetime import date, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import transaction
from core.models import (
    Daycare, Classroom, User, Employee, ECECredential, CredentialType,
    ClassroomTeacherAssignment, StaffAttendance, EmployeeAvailability,
    OvertimeRecord, StaffSchedule, Province
)

def update_teachers():
    daycare = Daycare.objects.filter(name__icontains='Happy kid').first()
    if not daycare:
        print("Daycare 'Happy kid Ac test' not found!")
        return

    print(f"Target Daycare: {daycare.name} ({daycare.id})")
    
    with transaction.atomic():
        print("\n--- 1. REMOVING OLD TEACHER & TEST EMPLOYEE RECORDS ---")
        
        # Keep daycare admin user/employee
        admin_user = User.objects.filter(username='testday').first()
        admin_emp = Employee.objects.filter(daycare=daycare, user=admin_user).first()
        
        # Delete old teacher assignments
        ClassroomTeacherAssignment.objects.filter(daycare=daycare).delete()
        
        # Clear primary/assistant teacher links on classrooms
        Classroom.objects.filter(daycare=daycare).update(primary_teacher=None, assistant_teacher=None)
        for c in Classroom.objects.filter(daycare=daycare):
            c.staff.clear()

        # Employees to remove (all except admin employee)
        old_employees = Employee.objects.filter(daycare=daycare).exclude(id=admin_emp.id if admin_emp else None)
        old_emp_ids = list(old_employees.values_list('id', flat=True))
        print(f"Removing {len(old_emp_ids)} old employee records...")

        ECECredential.objects.filter(employee_id__in=old_emp_ids).delete()
        StaffAttendance.objects.filter(employee_id__in=old_emp_ids).delete()
        EmployeeAvailability.objects.filter(employee_id__in=old_emp_ids).delete()
        OvertimeRecord.objects.filter(employee_id__in=old_emp_ids).delete()
        StaffSchedule.objects.filter(employee_id__in=old_emp_ids).delete()
        old_employees.delete()
        
        # Remove old test users associated with daycare (except testday & superadmins)
        test_users = User.objects.filter(daycare=daycare).exclude(username='testday').exclude(is_superuser=True)
        print(f"Removing {test_users.count()} old test users...")
        test_users.delete()

        print("\n--- 2. ADDING 3 NEW TEACHERS ---")
        
        # Classrooms
        infant_room = Classroom.objects.filter(daycare=daycare, room_code='INF-101').first()
        toddler_room = Classroom.objects.filter(daycare=daycare, room_code='TOD-201').first()
        preschool_room = Classroom.objects.filter(daycare=daycare, room_code='PRE-301').first()

        # Fetch credential types
        ece_diploma = CredentialType.objects.filter(name__icontains='ECE Diploma').first()
        first_aid = CredentialType.objects.filter(name__icontains='Standard First Aid').first()
        vsc = CredentialType.objects.filter(name__icontains='Vulnerable Sector').first()
        ontario = Province.objects.filter(code='ON').first() or Province.objects.first()

        teachers_data = [
            {
                "username": "emily.clark",
                "email": "emily.clark@happypath.com",
                "first_name": "Emily",
                "last_name": "Clark",
                "phone": "(555) 301-4455",
                "job_title": "Lead Infant Educator (RECE)",
                "sin": "890-123-456",
                "dob": date(1992, 4, 15),
                "start_date": date(2024, 1, 10),
                "classroom": infant_room,
                "cert_num": "RECE-88392"
            },
            {
                "username": "sarah.jenkins",
                "email": "sarah.jenkins@happypath.com",
                "first_name": "Sarah",
                "last_name": "Jenkins",
                "phone": "(555) 302-5566",
                "job_title": "Lead Toddler Educator (RECE)",
                "sin": "890-234-567",
                "dob": date(1990, 8, 22),
                "start_date": date(2023, 9, 1),
                "classroom": toddler_room,
                "cert_num": "RECE-77401"
            },
            {
                "username": "rachel.green",
                "email": "rachel.green@happypath.com",
                "first_name": "Rachel",
                "last_name": "Green",
                "phone": "(555) 303-6677",
                "job_title": "Lead Preschool Educator (RECE)",
                "sin": "890-345-678",
                "dob": date(1994, 11, 5),
                "start_date": date(2024, 3, 15),
                "classroom": preschool_room,
                "cert_num": "RECE-91204"
            }
        ]

        today = date.today()

        for t in teachers_data:
            # 1. Create User
            user = User.objects.create_user(
                username=t["username"],
                email=t["email"],
                password="password123",
                first_name=t["first_name"],
                last_name=t["last_name"],
                is_staff=True,
                daycare=daycare,
                status="Active"
            )

            # 2. Create Employee
            employee = Employee.objects.create(
                daycare=daycare,
                user=user,
                first_name=t["first_name"],
                last_name=t["last_name"],
                email=t["email"],
                phone=t["phone"],
                role="Teacher",
                job_title=t["job_title"],
                employment_type="full_time",
                status="active",
                date_of_birth=t["dob"],
                start_date=t["start_date"],
                sin=t["sin"]
            )

            # 3. Add ECE Credentials
            if ece_diploma:
                ECECredential.objects.create(
                    employee=employee,
                    daycare=daycare,
                    credential_type=ece_diploma,
                    certificate_number=t["cert_num"],
                    issuing_organization="College of Early Childhood Educators (CECE)",
                    province=ontario,
                    issue_date=t["start_date"] - timedelta(days=365),
                    expiry_date=today + timedelta(days=365),
                    verification_status="VERIFIED",
                    status="Active",
                    is_current=True
                )
            
            if first_aid:
                ECECredential.objects.create(
                    employee=employee,
                    daycare=daycare,
                    credential_type=first_aid,
                    certificate_number=f"FA-{t['first_name'][:3].upper()}-2025",
                    issuing_organization="Canadian Red Cross",
                    province=ontario,
                    issue_date=today - timedelta(days=180),
                    expiry_date=today + timedelta(days=540),
                    verification_status="VERIFIED",
                    status="Active",
                    is_current=True
                )

            if vsc:
                ECECredential.objects.create(
                    employee=employee,
                    daycare=daycare,
                    credential_type=vsc,
                    certificate_number=f"VSC-{t['first_name'][:3].upper()}-2025",
                    issuing_organization="Toronto Police Service",
                    province=ontario,
                    issue_date=today - timedelta(days=90),
                    expiry_date=today + timedelta(days=275),
                    verification_status="VERIFIED",
                    status="Active",
                    is_current=True
                )

            # 4. Assign to Classroom
            classroom = t["classroom"]
            if classroom:
                classroom.primary_teacher = user
                classroom.save()
                classroom.staff.add(user)

                ClassroomTeacherAssignment.objects.create(
                    daycare=daycare,
                    classroom=classroom,
                    employee=employee,
                    assignment_type="Primary",
                    status="Active",
                    assigned_date=t["start_date"],
                    created_by=admin_user
                )

            print(f"Created Teacher: {employee.first_name} {employee.last_name} ({employee.email}) -> Assigned to {classroom.room_name if classroom else 'None'}")

    print("\n=== TEACHER UPDATE COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    update_teachers()

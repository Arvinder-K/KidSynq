import os
import sys
import django
from datetime import date, time, timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.db import transaction
from django.utils import timezone
from core.models import (
    Daycare, Branch, Classroom, Student, Program, AgeGroup, User, Employee,
    Family, Guardian, FamilyGuardian, FamilyChild, ClassroomStudent,
    ClassroomTeacherAssignment, StudentAttendance, StudentEmergencyContact,
    StudentPickup, HealthProfile, DailyReport, SafeArrivalDepartureEvent,
    Invoice, InvoiceItem, Payment, ChildEnrollment, ChildVaccinationRecord,
    ConsentFormAssignment, GuardianInvitation, StaffSchedule, StaffShortageAlert,
    RatioComplianceHistory, WaitlistEntry, RegistrationApplication, Document
)

def clean_and_seed():
    daycare = Daycare.objects.filter(name__icontains='Happy kid').first()
    if not daycare:
        print("Error: Daycare 'Happy kid Ac test' not found!")
        return

    print(f"Target Daycare: {daycare.name} ({daycare.id})")
    
    branch = Branch.objects.filter(daycare=daycare).first()
    if not branch:
        branch = Branch.objects.create(daycare=daycare, name='Main Campus')
        print(f"Created branch: {branch.name}")
    else:
        print(f"Using branch: {branch.name}")

    with transaction.atomic():
        print("\n--- 1. CLEANING UP EXISTING DATA ---")
        # Find all students belonging to this daycare
        students = Student.objects.filter(daycare=daycare)
        student_ids = list(students.values_list('id', flat=True))
        print(f"Found {len(student_ids)} existing students to remove.")

        # Remove student-related records
        DailyReport.objects.filter(daycare=daycare).delete()
        StudentAttendance.objects.filter(daycare=daycare).delete()
        SafeArrivalDepartureEvent.objects.filter(daycare=daycare).delete()
        StudentPickup.objects.filter(daycare=daycare).delete()
        StudentEmergencyContact.objects.filter(student_id__in=student_ids).delete()
        HealthProfile.objects.filter(daycare=daycare).delete()
        ChildVaccinationRecord.objects.filter(student_id__in=student_ids).delete()
        ConsentFormAssignment.objects.filter(student_id__in=student_ids).delete()
        GuardianInvitation.objects.filter(daycare=daycare).delete()
        WaitlistEntry.objects.filter(daycare=daycare).delete()
        RegistrationApplication.objects.filter(daycare=daycare).delete()
        ChildEnrollment.objects.filter(student_id__in=student_ids).delete()
        ClassroomStudent.objects.filter(student_id__in=student_ids).delete()

        # Invoices and payments
        InvoiceItem.objects.filter(student_id__in=student_ids).delete()
        Payment.objects.filter(daycare=daycare).delete()
        Invoice.objects.filter(daycare=daycare).delete()

        # Family links
        FamilyChild.objects.filter(student_id__in=student_ids).delete()
        FamilyGuardian.objects.filter(family__daycare=daycare).delete()
        Family.objects.filter(daycare=daycare).delete()
        Guardian.objects.filter(daycare=daycare).delete()

        # Delete students
        students.delete()
        print("Deleted existing students and all linked child data.")

        # Remove classroom-related records
        classrooms = Classroom.objects.filter(daycare=daycare)
        classroom_ids = list(classrooms.values_list('id', flat=True))
        print(f"Found {len(classroom_ids)} existing classrooms to remove.")

        ClassroomTeacherAssignment.objects.filter(daycare=daycare).delete()
        StaffSchedule.objects.filter(daycare=daycare).delete()
        StaffShortageAlert.objects.filter(daycare=daycare).delete()
        RatioComplianceHistory.objects.filter(daycare=daycare).delete()
        ClassroomStudent.objects.filter(classroom_id__in=classroom_ids).delete()
        classrooms.delete()
        print("Deleted existing classrooms and all classroom assignments.")

        print("\n--- 2. SETTING UP PROGRAMS & AGE GROUPS ---")
        infant_ag = AgeGroup.objects.filter(daycare=daycare, name__iexact='Infant').first()
        toddler_ag = AgeGroup.objects.filter(daycare=daycare, name__iexact='Toddler').first()
        preschool_ag = AgeGroup.objects.filter(daycare=daycare, name__iexact='Preschool').first()
        if not preschool_ag:
            preschool_ag = AgeGroup.objects.filter(daycare=daycare, name__iexact='Pre-K').first()

        prog_infant, _ = Program.objects.get_or_create(
            daycare=daycare, name='Infant Care Program',
            defaults={'age_group': 'Infant', 'min_age_months': 0, 'max_age_months': 18, 'status': 'Active'}
        )
        prog_toddler, _ = Program.objects.get_or_create(
            daycare=daycare, name='Toddler Discovery Program',
            defaults={'age_group': 'Toddler', 'min_age_months': 18, 'max_age_months': 36, 'status': 'Active'}
        )
        prog_preschool, _ = Program.objects.get_or_create(
            daycare=daycare, name='Preschool Early Learning',
            defaults={'age_group': 'Preschool', 'min_age_months': 36, 'max_age_months': 60, 'status': 'Active'}
        )

        # Teachers
        teachers = list(User.objects.filter(daycare=daycare, is_staff=True))
        if not teachers:
            teachers = list(User.objects.filter(daycare=daycare))
        teacher1 = teachers[0] if len(teachers) > 0 else None
        teacher2 = teachers[1] if len(teachers) > 1 else teacher1
        teacher3 = teachers[2] if len(teachers) > 2 else teacher1

        print("\n--- 3. CREATING 3 CLASSROOMS ---")
        room1 = Classroom.objects.create(
            daycare=daycare,
            branch=branch,
            program=prog_infant,
            age_group=infant_ag,
            room_name='Little Explorers',
            room_code='INF-101',
            capacity=8,
            min_age_months=6,
            max_age_months=18,
            location='Ground Floor, Wing A',
            floor='Ground Floor',
            building='Main Building',
            color='#3B82F6',
            status='Active',
            primary_teacher=teacher1,
            description='Infant nurturing and sensory development classroom.'
        )

        room2 = Classroom.objects.create(
            daycare=daycare,
            branch=branch,
            program=prog_toddler,
            age_group=toddler_ag,
            room_name='Sunshine Toddlers',
            room_code='TOD-201',
            capacity=12,
            min_age_months=18,
            max_age_months=36,
            location='Ground Floor, Wing B',
            floor='Ground Floor',
            building='Main Building',
            color='#F59E0B',
            status='Active',
            primary_teacher=teacher2,
            description='Active toddler discovery, motor skills and language exploration.'
        )

        room3 = Classroom.objects.create(
            daycare=daycare,
            branch=branch,
            program=prog_preschool,
            age_group=preschool_ag,
            room_name='Future Stars Pre-K',
            room_code='PRE-301',
            capacity=15,
            min_age_months=36,
            max_age_months=60,
            location='First Floor, Wing C',
            floor='1st Floor',
            building='Main Building',
            color='#10B981',
            status='Active',
            primary_teacher=teacher3,
            description='Preschool school readiness, literacy, STEM, and cooperative social play.'
        )

        print(f"Created 3 Classrooms:")
        print(f"  1. {room1.room_name} ({room1.room_code}) - Capacity: {room1.capacity}")
        print(f"  2. {room2.room_name} ({room2.room_code}) - Capacity: {room2.capacity}")
        print(f"  3. {room3.room_name} ({room3.room_code}) - Capacity: {room3.capacity}")

        print("\n--- 4. CREATING 20 CHILDREN & LINKING DATA ---")
        
        today = date.today()
        
        children_data = [
            # 5 Infants (Little Explorers, INF-101) - Ages 7 to 15 months
            {
                "first_name": "Liam", "last_name": "Tremblay", "preferred_name": "Liam",
                "gender": "Male", "dob": today - timedelta(days=240), # ~8 months
                "classroom": room1, "allergies": "None", "dietary": "Formula & Purees",
                "guardian_first": "Sophie", "guardian_last": "Tremblay", "rel": "Mother",
                "email": "sophie.tremblay@example.com", "phone": "(555) 234-5678",
                "address": "142 Maple Leaf Ave, Toronto, ON",
                "emergency_name": "Marc Tremblay", "emergency_rel": "Father", "emergency_phone": "(555) 234-5679"
            },
            {
                "first_name": "Emma", "last_name": "Chen", "preferred_name": "Emmy",
                "gender": "Female", "dob": today - timedelta(days=300), # ~10 months
                "classroom": room1, "allergies": "None", "dietary": "Vegetarian Purees",
                "guardian_first": "David", "guardian_last": "Chen", "rel": "Father",
                "email": "david.chen@example.com", "phone": "(555) 345-6789",
                "address": "88 Bloor St W, Suite 1204, Toronto, ON",
                "emergency_name": "Lin Chen", "emergency_rel": "Mother", "emergency_phone": "(555) 345-6780"
            },
            {
                "first_name": "Noah", "last_name": "Patel", "preferred_name": "Noah",
                "gender": "Male", "dob": today - timedelta(days=360), # ~12 months
                "classroom": room1, "allergies": "Eggs", "dietary": "Egg-Free, Halal",
                "guardian_first": "Priya", "guardian_last": "Patel", "rel": "Mother",
                "email": "priya.patel@example.com", "phone": "(555) 456-7890",
                "address": "52 Kingfisher Way, Mississauga, ON",
                "emergency_name": "Amit Patel", "emergency_rel": "Father", "emergency_phone": "(555) 456-7891"
            },
            {
                "first_name": "Mia", "last_name": "Dubois", "preferred_name": "Mia",
                "gender": "Female", "dob": today - timedelta(days=210), # ~7 months
                "classroom": room1, "allergies": "None", "dietary": "Breastmilk / Iron Formula",
                "guardian_first": "Claire", "guardian_last": "Dubois", "rel": "Mother",
                "email": "claire.dubois@example.com", "phone": "(555) 567-8901",
                "address": "310 Queens Quay W, Toronto, ON",
                "emergency_name": "Julien Dubois", "emergency_rel": "Father", "emergency_phone": "(555) 567-8902"
            },
            {
                "first_name": "Lucas", "last_name": "Silva", "preferred_name": "Lucas",
                "gender": "Male", "dob": today - timedelta(days=420), # ~14 months
                "classroom": room1, "allergies": "None", "dietary": "Standard Toddler Transition",
                "guardian_first": "Camila", "guardian_last": "Silva", "rel": "Mother",
                "email": "camila.silva@example.com", "phone": "(555) 678-9012",
                "address": "77 Spadina Rd, Toronto, ON",
                "emergency_name": "Mateo Silva", "emergency_rel": "Father", "emergency_phone": "(555) 678-9013"
            },

            # 8 Toddlers (Sunshine Toddlers, TOD-201) - Ages 19 to 34 months
            {
                "first_name": "Oliver", "last_name": "Smith", "preferred_name": "Ollie",
                "gender": "Male", "dob": today - timedelta(days=600), # ~20 months
                "classroom": room2, "allergies": "Peanuts", "dietary": "Nut-Free facility",
                "guardian_first": "Sarah", "guardian_last": "Smith", "rel": "Mother",
                "email": "sarah.smith@example.com", "phone": "(555) 789-0123",
                "address": "45 Park Lane, Toronto, ON",
                "emergency_name": "James Smith", "emergency_rel": "Father", "emergency_phone": "(555) 789-0124"
            },
            {
                "first_name": "Ava", "last_name": "Johnson", "preferred_name": "Ava",
                "gender": "Female", "dob": today - timedelta(days=660), # ~22 months
                "classroom": room2, "allergies": "None", "dietary": "No restriction",
                "guardian_first": "Michael", "guardian_last": "Johnson", "rel": "Father",
                "email": "michael.j@example.com", "phone": "(555) 890-1234",
                "address": "12 Richmond St E, Toronto, ON",
                "emergency_name": "Rachel Johnson", "emergency_rel": "Mother", "emergency_phone": "(555) 890-1235"
            },
            {
                "first_name": "Ethan", "last_name": "Roy", "preferred_name": "Ethan",
                "gender": "Male", "dob": today - timedelta(days=730), # ~24 months (2 yrs)
                "classroom": room2, "allergies": "Dairy / Lactose", "dietary": "Lactose-Free Milk",
                "guardian_first": "Genevieve", "guardian_last": "Roy", "rel": "Mother",
                "email": "genevieve.roy@example.com", "phone": "(555) 901-2345",
                "address": "902 Bay St, Toronto, ON",
                "emergency_name": "Paul Roy", "emergency_rel": "Father", "emergency_phone": "(555) 901-2346"
            },
            {
                "first_name": "Sophia", "last_name": "Kim", "preferred_name": "Sophy",
                "gender": "Female", "dob": today - timedelta(days=790), # ~26 months
                "classroom": room2, "allergies": "None", "dietary": "Standard Toddler",
                "guardian_first": "Min-Jun", "guardian_last": "Kim", "rel": "Father",
                "email": "minjun.kim@example.com", "phone": "(555) 012-3456",
                "address": "64 Charles St W, Toronto, ON",
                "emergency_name": "Eun-Ji Kim", "emergency_rel": "Mother", "emergency_phone": "(555) 012-3457"
            },
            {
                "first_name": "Leo", "last_name": "Gomez", "preferred_name": "Leo",
                "gender": "Male", "dob": today - timedelta(days=850), # ~28 months
                "classroom": room2, "allergies": "None", "dietary": "No pork",
                "guardian_first": "Sofia", "guardian_last": "Gomez", "rel": "Mother",
                "email": "sofia.gomez@example.com", "phone": "(555) 123-4560",
                "address": "25 Dundas St W, Toronto, ON",
                "emergency_name": "Carlos Gomez", "emergency_rel": "Father", "emergency_phone": "(555) 123-4561"
            },
            {
                "first_name": "Isabella", "last_name": "Wong", "preferred_name": "Bella",
                "gender": "Female", "dob": today - timedelta(days=910), # ~30 months
                "classroom": room2, "allergies": "Shellfish", "dietary": "Fish & Shellfish Free",
                "guardian_first": "Kevin", "guardian_last": "Wong", "rel": "Father",
                "email": "kevin.wong@example.com", "phone": "(555) 234-5671",
                "address": "550 Front St W, Toronto, ON",
                "emergency_name": "Grace Wong", "emergency_rel": "Mother", "emergency_phone": "(555) 234-5672"
            },
            {
                "first_name": "Jackson", "last_name": "Brown", "preferred_name": "Jack",
                "gender": "Male", "dob": today - timedelta(days=970), # ~32 months
                "classroom": room2, "allergies": "None", "dietary": "Standard Toddler",
                "guardian_first": "Emily", "guardian_last": "Brown", "rel": "Mother",
                "email": "emily.brown@example.com", "phone": "(555) 345-6782",
                "address": "180 University Ave, Toronto, ON",
                "emergency_name": "William Brown", "emergency_rel": "Father", "emergency_phone": "(555) 345-6783"
            },
            {
                "first_name": "Harper", "last_name": "Taylor", "preferred_name": "Harper",
                "gender": "Female", "dob": today - timedelta(days=1020), # ~34 months
                "classroom": room2, "allergies": "None", "dietary": "Vegetarian",
                "guardian_first": "Jessica", "guardian_last": "Taylor", "rel": "Mother",
                "email": "jessica.taylor@example.com", "phone": "(555) 456-7893",
                "address": "33 Harbour St, Toronto, ON",
                "emergency_name": "Daniel Taylor", "emergency_rel": "Father", "emergency_phone": "(555) 456-7894"
            },

            # 7 Preschoolers (Future Stars Pre-K, PRE-301) - Ages 37 to 54 months
            {
                "first_name": "Alexander", "last_name": "Martin", "preferred_name": "Alex",
                "gender": "Male", "dob": today - timedelta(days=1150), # ~38 months
                "classroom": room3, "allergies": "None", "dietary": "Standard",
                "guardian_first": "Patrick", "guardian_last": "Martin", "rel": "Father",
                "email": "patrick.martin@example.com", "phone": "(555) 567-8904",
                "address": "120 St George St, Toronto, ON",
                "emergency_name": "Laura Martin", "emergency_rel": "Mother", "emergency_phone": "(555) 567-8905"
            },
            {
                "first_name": "Charlotte", "last_name": "Lee", "preferred_name": "Charlie",
                "gender": "Female", "dob": today - timedelta(days=1250), # ~41 months
                "classroom": room3, "allergies": "None", "dietary": "No beef",
                "guardian_first": "Hannah", "guardian_last": "Lee", "rel": "Mother",
                "email": "hannah.lee@example.com", "phone": "(555) 678-9015",
                "address": "410 Yonge St, Toronto, ON",
                "emergency_name": "Brian Lee", "emergency_rel": "Father", "emergency_phone": "(555) 678-9016"
            },
            {
                "first_name": "Benjamin", "last_name": "Gagnon", "preferred_name": "Ben",
                "gender": "Male", "dob": today - timedelta(days=1350), # ~44 months
                "classroom": room3, "allergies": "Gluten", "dietary": "Gluten-Free Snacks",
                "guardian_first": "Isabelle", "guardian_last": "Gagnon", "rel": "Mother",
                "email": "isabelle.g@example.com", "phone": "(555) 789-0126",
                "address": "700 King St W, Toronto, ON",
                "emergency_name": "Eric Gagnon", "emergency_rel": "Father", "emergency_phone": "(555) 789-0127"
            },
            {
                "first_name": "Amelia", "last_name": "Singh", "preferred_name": "Amy",
                "gender": "Female", "dob": today - timedelta(days=1450), # ~48 months (4 yrs)
                "classroom": room3, "allergies": "None", "dietary": "Strict Vegetarian",
                "guardian_first": "Harpreet", "guardian_last": "Singh", "rel": "Father",
                "email": "harpreet.singh@example.com", "phone": "(555) 890-1237",
                "address": "15 Bramalea Rd, Brampton, ON",
                "emergency_name": "Simran Singh", "emergency_rel": "Mother", "emergency_phone": "(555) 890-1238"
            },
            {
                "first_name": "Lucas", "last_name": "Murphy", "preferred_name": "Luke",
                "gender": "Male", "dob": today - timedelta(days=1520), # ~50 months
                "classroom": room3, "allergies": "Sesame", "dietary": "Sesame-Free",
                "guardian_first": "Kelly", "guardian_last": "Murphy", "rel": "Mother",
                "email": "kelly.murphy@example.com", "phone": "(555) 901-2348",
                "address": "22 Queen St E, Toronto, ON",
                "emergency_name": "Sean Murphy", "emergency_rel": "Father", "emergency_phone": "(555) 901-2349"
            },
            {
                "first_name": "Chloe", "last_name": "Wilson", "preferred_name": "Chloe",
                "gender": "Female", "dob": today - timedelta(days=1580), # ~52 months
                "classroom": room3, "allergies": "None", "dietary": "Standard",
                "guardian_first": "Amanda", "guardian_last": "Wilson", "rel": "Mother",
                "email": "amanda.wilson@example.com", "phone": "(555) 012-3459",
                "address": "95 Bathurst St, Toronto, ON",
                "emergency_name": "Craig Wilson", "emergency_rel": "Father", "emergency_phone": "(555) 012-3460"
            },
            {
                "first_name": "Daniel", "last_name": "Fortin", "preferred_name": "Danny",
                "gender": "Male", "dob": today - timedelta(days=1640), # ~54 months
                "classroom": room3, "allergies": "None", "dietary": "Standard",
                "guardian_first": "Melissa", "guardian_last": "Fortin", "rel": "Mother",
                "email": "melissa.fortin@example.com", "phone": "(555) 123-4562",
                "address": "500 Lake Shore Blvd, Toronto, ON",
                "emergency_name": "Jean Fortin", "emergency_rel": "Father", "emergency_phone": "(555) 123-4563"
            }
        ]

        for i, c in enumerate(children_data, 1):
            adm_num = f"ADM-2026-{i:03d}"
            joining = today - timedelta(days=60 + i*5)
            
            # 1. Create Student
            student = Student.objects.create(
                daycare=daycare,
                branch=branch,
                admission_number=adm_num,
                first_name=c["first_name"],
                last_name=c["last_name"],
                preferred_name=c["preferred_name"],
                dob=c["dob"],
                gender=c["gender"],
                language="English",
                admission_date=joining,
                joining_date=joining,
                status="Active",
                allergies=c["allergies"],
                dietary_restrictions=c["dietary"],
                medical_conditions="None" if c["allergies"] == "None" else f"Allergic to {c['allergies']}",
                doctor_name="Dr. Jane Henderson, MD",
                doctor_phone="(555) 800-1122",
                hospital_name="Hospital for Sick Children (SickKids)"
            )

            # 2. Create Family
            family = Family.objects.create(
                daycare=daycare,
                family_name=f"{c['last_name']} Family",
                status="Active",
                primary_contact=f"{c['guardian_first']} {c['guardian_last']}",
                primary_email=c["email"],
                primary_phone=c["phone"],
                address=c["address"],
                notes="Registered for 2026 Academic Year"
            )

            # 3. Create Guardian
            guardian = Guardian.objects.create(
                daycare=daycare,
                first_name=c["guardian_first"],
                last_name=c["guardian_last"],
                preferred_name=c["guardian_first"],
                email=c["email"],
                phone=c["phone"],
                status="Active"
            )

            # 4. Link Family & Guardian
            FamilyGuardian.objects.create(
                family=family,
                guardian=guardian,
                relationship=c["rel"],
                is_primary=True,
                status="Active"
            )

            # 5. Link Family & Child
            FamilyChild.objects.create(
                family=family,
                student=student
            )

            # 6. Assign to Classroom
            cs = ClassroomStudent.objects.create(
                classroom=c["classroom"],
                student=student,
                start_date=joining,
                status="Active"
            )

            # 7. Create Emergency Contact
            StudentEmergencyContact.objects.create(
                student=student,
                name=c["emergency_name"],
                relationship=c["emergency_rel"],
                mobile=c["emergency_phone"],
                email=c["email"],
                is_primary=True
            )

            # 8. Create Authorized Pickup Person
            StudentPickup.objects.create(
                daycare=daycare,
                student=student,
                family=family,
                name=f"{c['guardian_first']} {c['guardian_last']}",
                relationship=c["rel"],
                phone=c["phone"],
                email=c["email"],
                authorization_status="ACTIVE",
                status="Active",
                approval_status="Approved",
                id_proof_status="Verified"
            )

            # 9. Create Health Profile
            HealthProfile.objects.create(
                daycare=daycare,
                student=student,
                blood_type="O+",
                ohip_number=f"4432-{i:03d}-987",
                primary_physician="Dr. Jane Henderson, MD",
                clinic="Downtown Paediatrics Care",
                dentist="Dr. Robert Miller, DDS",
                hospital_preference="Hospital for Sick Children (SickKids)",
                emergency_medical_consent=True,
                health_notes=f"Child is in good health. Diet: {c['dietary']}. Allergies: {c['allergies']}."
            )

            # 10. Record Today's Attendance (Check-in between 08:00 and 09:00 AM)
            checkin_min = 10 + (i * 2) % 45
            StudentAttendance.objects.create(
                daycare=daycare,
                branch=branch,
                student=student,
                classroom=c["classroom"],
                enrollment=cs,
                attendance_date=today,
                attendance_status="PRESENT",
                check_in_time=time(8, checkin_min),
                arrival_type="STANDARD",
                created_by=teacher1
            )

            print(f"  [{i}/20] {student.first_name} {student.last_name} ({adm_num}) -> {c['classroom'].room_name}")

    print("\n=== SEEDING COMPLETED SUCCESSFULLY ===")

if __name__ == '__main__':
    clean_and_seed()

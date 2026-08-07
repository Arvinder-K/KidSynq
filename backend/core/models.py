import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.contrib.contenttypes.models import ContentType
from django.contrib.contenttypes.fields import GenericForeignKey
from django.db.models.signals import post_save
from django.dispatch import receiver

class Organization(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Daycare(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(Organization, on_delete=models.SET_NULL, null=True, blank=True, related_name='daycares')
    daycare_code = models.CharField(max_length=100, null=True, blank=True)
    name = models.CharField(max_length=255)
    logo = models.CharField(max_length=2048, null=True, blank=True)
    registration_number = models.CharField(max_length=100, null=True, blank=True)
    license_number = models.CharField(max_length=100, null=True, blank=True)
    owner_name = models.CharField(max_length=255, null=True, blank=True)
    director_name = models.CharField(max_length=255, null=True, blank=True)
    contact_person = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    website = models.URLField(null=True, blank=True)
    address1 = models.CharField(max_length=255, null=True, blank=True)
    address2 = models.CharField(max_length=255, null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    country = models.CharField(max_length=100, null=True, blank=True)
    postal_code = models.CharField(max_length=20, null=True, blank=True)
    opening_time = models.TimeField(null=True, blank=True)
    closing_time = models.TimeField(null=True, blank=True)
    working_days = models.JSONField(null=True, blank=True) # Assuming JSON or comma separated string
    capacity = models.IntegerField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Inactive')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Branch(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='branches')
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    mobile = models.CharField(max_length=50, null=True, blank=True)
    profile_photo_path = models.CharField(max_length=2048, null=True, blank=True)
    terms_accepted = models.BooleanField(default=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='users')
    force_password_change = models.BooleanField(default=False)
    status = models.CharField(max_length=50, default='Active')
    
    # Optional references
    created_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='created_users')
    updated_by = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_users')

class SubscriptionPlan(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    max_teachers = models.IntegerField(default=0)
    max_staff = models.IntegerField(default=0)
    attendance = models.BooleanField(default=False)
    activities = models.BooleanField(default=False)
    fees = models.BooleanField(default=False)
    reports = models.BooleanField(default=False)
    documents = models.BooleanField(default=False)
    gallery = models.BooleanField(default=False)
    notifications = models.BooleanField(default=False)
    csv_export = models.BooleanField(default=False)
    pdf_export = models.BooleanField(default=False)
    compliance = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DaycareSubscription(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='subscriptions')
    subscription_plan = models.ForeignKey(SubscriptionPlan, on_delete=models.CASCADE)
    start_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    renewal_date = models.DateField(null=True, blank=True)
    subscription_status = models.CharField(max_length=50, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Employee(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='employees')
    user = models.OneToOneField(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile')
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    preferred_name = models.CharField(max_length=255, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    phone = models.CharField(max_length=50, null=True, blank=True)
    employee_number = models.CharField(max_length=100, null=True, blank=True)
    role = models.CharField(max_length=100)
    employment_type = models.CharField(max_length=100, null=True, blank=True)
    hire_date = models.DateField(null=True, blank=True)
    sin = models.CharField(max_length=255, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Student(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='students')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='students')
    admission_number = models.CharField(max_length=100, null=True, blank=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    dob = models.DateField(null=True, blank=True)
    gender = models.CharField(max_length=50, null=True, blank=True)
    admission_date = models.DateField(null=True, blank=True)
    joining_date = models.DateField(null=True, blank=True)
    photo = models.CharField(max_length=2048, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    
    # Medical Info
    allergies = models.TextField(null=True, blank=True)
    medical_conditions = models.TextField(null=True, blank=True)
    medication = models.TextField(null=True, blank=True)
    doctor_name = models.CharField(max_length=255, null=True, blank=True)
    doctor_phone = models.CharField(max_length=100, null=True, blank=True)
    hospital_name = models.CharField(max_length=255, null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class StudentEmergencyContact(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='emergency_contacts')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    mobile = models.CharField(max_length=100)
    email = models.EmailField(null=True, blank=True)
    is_primary = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class StudentPickup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='pickups')
    name = models.CharField(max_length=255)
    relationship = models.CharField(max_length=100)
    phone = models.CharField(max_length=100)
    status = models.CharField(max_length=50, default='Active') # Active/Blocked
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Announcement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='announcements')
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_announcements')
    title = models.CharField(max_length=255)
    content = models.TextField()
    type = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, default='Published')
    published_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class AnnouncementAudience(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='audiences')
    audience_type = models.CharField(max_length=100) # e.g., 'role', 'classroom', 'specific_users'
    audience_id = models.CharField(max_length=255, null=True, blank=True) # ID of the role/classroom, if applicable
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AnnouncementRead(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    announcement = models.ForeignKey(Announcement, on_delete=models.CASCADE, related_name='reads')
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='read_announcements')
    read_at = models.DateTimeField(auto_now_add=True)
    
    def __str__(self):
        return f"{self.user.get_full_name()} read {self.announcement.title}"

    class Meta:
        unique_together = ('announcement', 'user')

# ==========================================
# PROXY MODELS FOR DJANGO ADMIN GROUPING
# ==========================================
class ManagedDaycare(Daycare):
    class Meta:
        proxy = True
        verbose_name = 'Daycare Management'
        verbose_name_plural = '1. Daycare Management'

class ManagedUser(User):
    class Meta:
        proxy = True
        verbose_name = 'Platform User'
        verbose_name_plural = '2. Platform Users'

class ManagedSubscriptionPlan(SubscriptionPlan):
    class Meta:
        proxy = True
        verbose_name = 'Subscription Plan'
        verbose_name_plural = '3. Subscription Plans'

class ManagedDaycareSubscription(DaycareSubscription):
    class Meta:
        proxy = True
        verbose_name = 'Assigned Subscription'
        verbose_name_plural = '4. Assigned Subscriptions'

class Program(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='programs')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    age_group = models.CharField(max_length=100, null=True, blank=True)
    min_age_months = models.IntegerField(null=True, blank=True)
    max_age_months = models.IntegerField(null=True, blank=True)
    program_fee = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    color = models.CharField(max_length=50, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    sort_order = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class Classroom(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='classrooms')
    program = models.ForeignKey(Program, on_delete=models.SET_NULL, null=True, blank=True, related_name='classrooms')
    room_name = models.CharField(max_length=255)
    room_code = models.CharField(max_length=100, null=True, blank=True)
    capacity = models.IntegerField(null=True, blank=True)
    min_age_months = models.IntegerField(null=True, blank=True)
    max_age_months = models.IntegerField(null=True, blank=True)
    
    primary_teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='primary_classrooms')
    assistant_teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assistant_classrooms')
    staff = models.ManyToManyField(User, related_name='assigned_classrooms', blank=True)
    
    color = models.CharField(max_length=50, null=True, blank=True)
    floor = models.CharField(max_length=100, null=True, blank=True)
    building = models.CharField(max_length=100, null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class ClassroomTeacherAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='teacher_assignments')
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='teacher_assignments')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='classroom_assignments')
    assignment_type = models.CharField(max_length=50) # Primary, Assistant
    status = models.CharField(max_length=50, default='Active')
    assigned_date = models.DateField(auto_now_add=True)
    end_date = models.DateField(null=True, blank=True)
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_teacher_assignments')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_teacher_assignments')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

class ClassroomStudent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    classroom = models.ForeignKey(Classroom, on_delete=models.CASCADE, related_name='enrollments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='classroom_enrollments')
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='Active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('classroom', 'student')

class StudentAttendance(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='attendances')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attendances')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='attendances')
    
    attendance_date = models.DateField()
    attendance_status = models.CharField(max_length=50) # Present, Absent, Late, Sick, Holiday, Leave, Half Day
    check_in_time = models.TimeField(null=True, blank=True)
    check_out_time = models.TimeField(null=True, blank=True)
    
    received_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='received_students')
    released_by = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='released_students')
    pickup_person = models.ForeignKey(StudentPickup, on_delete=models.SET_NULL, null=True, blank=True, related_name='pickups_made')
    
    remarks = models.TextField(null=True, blank=True)
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_attendances')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_attendances')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        unique_together = ('student', 'attendance_date')

class DailyReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='daily_reports')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='daily_reports')
    classroom = models.ForeignKey(Classroom, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    attendance_record = models.ForeignKey(StudentAttendance, on_delete=models.SET_NULL, null=True, blank=True, related_name='daily_reports')
    
    report_date = models.DateField()
    teacher = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_reports')
    status = models.CharField(max_length=50, default='Draft') # Draft, Completed, Shared, Archived
    
    submitted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    
    class Meta:
        unique_together = ('student', 'report_date')

class MealRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='meals')
    meal_type = models.CharField(max_length=100) # Breakfast, AM Snack, Lunch, PM Snack, Late Snack, Dinner
    food_provided = models.CharField(max_length=255, null=True, blank=True)
    amount_eaten = models.CharField(max_length=50) # None, Some, Most, All
    recorded_at = models.DateTimeField(auto_now_add=True)

class NapRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='naps')
    start_time = models.TimeField()
    end_time = models.TimeField(null=True, blank=True)
    quality = models.CharField(max_length=50, null=True, blank=True) # Good, Restless, Did Not Sleep
    recorded_at = models.DateTimeField(auto_now_add=True)

class ToiletingRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='toileting')
    type = models.CharField(max_length=50) # Diaper, Potty, Accident
    condition = models.CharField(max_length=50, null=True, blank=True) # Wet, BM, Dry, Mixed
    recorded_at = models.DateTimeField(auto_now_add=True)

class ActivityRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='activities')
    activity_type = models.CharField(max_length=100) # Learning, Outdoor Play, etc.
    description = models.CharField(max_length=255, null=True, blank=True)
    teacher_notes = models.TextField(null=True, blank=True)
    recorded_at = models.DateTimeField(auto_now_add=True)

class MoodRecord(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daily_report = models.ForeignKey(DailyReport, on_delete=models.CASCADE, related_name='moods')
    mood = models.CharField(max_length=50) # Happy, Sad, Fussy, etc.
    recorded_at = models.DateTimeField(auto_now_add=True)

class FeeType(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='fee_types')
    name = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    frequency = models.CharField(max_length=50, default='One-time') # One-time, Weekly, Monthly, Yearly
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Invoice(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='invoices')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='invoices')
    invoice_number = models.CharField(max_length=100, unique=True)
    issue_date = models.DateField()
    due_date = models.DateField()
    subtotal = models.DecimalField(max_digits=10, decimal_places=2)
    tax = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    discount = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    status = models.CharField(max_length=50, default='Unpaid') # Draft, Unpaid, Partially Paid, Paid, Overdue, Cancelled
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class InvoiceItem(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='items')
    fee_type = models.ForeignKey(FeeType, on_delete=models.SET_NULL, null=True, blank=True)
    student = models.ForeignKey(Student, on_delete=models.SET_NULL, null=True, blank=True)
    description = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Payment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='payments')
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField()
    payment_method = models.CharField(max_length=100) # Cash, Credit Card, Bank Transfer, Cheque
    transaction_reference = models.CharField(max_length=255, null=True, blank=True)
    notes = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class HealthProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='health_profiles')
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='health_profile')
    
    blood_type = models.CharField(max_length=10, null=True, blank=True)
    ohip_number = models.CharField(max_length=50, null=True, blank=True)
    primary_physician = models.CharField(max_length=255, null=True, blank=True)
    clinic = models.CharField(max_length=255, null=True, blank=True)
    dentist = models.CharField(max_length=255, null=True, blank=True)
    hospital_preference = models.CharField(max_length=255, null=True, blank=True)
    emergency_medical_consent = models.BooleanField(default=False)
    special_needs = models.TextField(null=True, blank=True)
    health_notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Allergy(models.Model):
    ALLERGY_TYPES = (
        ('Food', 'Food'),
        ('Medication', 'Medication'),
        ('Environmental', 'Environmental'),
        ('Other', 'Other'),
    )
    SEVERITY_CHOICES = (
        ('Mild', 'Mild'),
        ('Moderate', 'Moderate'),
        ('Severe', 'Severe'),
        ('Anaphylactic', 'Anaphylactic'),
    )

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='allergy_records')
    
    type = models.CharField(max_length=50, choices=ALLERGY_TYPES)
    allergen = models.CharField(max_length=255)
    severity = models.CharField(max_length=50, choices=SEVERITY_CHOICES)
    symptoms = models.TextField(null=True, blank=True)
    emergency_response = models.TextField(null=True, blank=True)
    epipen_required = models.BooleanField(default=False)
    expiry_date = models.DateField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Medication(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='medication_records')
    
    medication_name = models.CharField(max_length=255)
    dosage = models.CharField(max_length=100)
    route = models.CharField(max_length=100, null=True, blank=True)
    frequency = models.CharField(max_length=100)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    prescribing_doctor = models.CharField(max_length=255, null=True, blank=True)
    parent_consent = models.BooleanField(default=False)
    storage_location = models.CharField(max_length=255, null=True, blank=True)
    special_instructions = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class MedicationAdministration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medication = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name='administrations')
    administered_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='administered_medications')
    witness = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='witnessed_medications')
    
    date = models.DateField()
    time = models.TimeField()
    dosage_given = models.CharField(max_length=100, null=True, blank=True)
    outcome = models.CharField(max_length=255, null=True, blank=True)
    missed_dose = models.BooleanField(default=False)
    reason = models.CharField(max_length=255, null=True, blank=True)
    teacher_notes = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    color = models.CharField(max_length=50, null=True, blank=True)
    is_system = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentFolder(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='folders')
    parent = models.ForeignKey('self', on_delete=models.CASCADE, null=True, blank=True, related_name='subfolders')
    name = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class Document(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='documents')
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True)
    folder = models.ForeignKey(DocumentFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    
    title = models.CharField(max_length=255)
    description = models.TextField(null=True, blank=True)
    file_path = models.FileField(upload_to='documents/')
    file_type = models.CharField(max_length=100, null=True, blank=True)
    file_size = models.BigIntegerField(null=True, blank=True)
    
    # Generic relations to associate with Student or Employee
    content_type = models.ForeignKey(ContentType, on_delete=models.SET_NULL, null=True, blank=True)
    object_id = models.UUIDField(null=True, blank=True)
    related_object = GenericForeignKey('content_type', 'object_id')
    
    status = models.CharField(max_length=50, default='active')
    visibility = models.CharField(max_length=50, default='private')
    
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='uploaded_documents')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class DocumentExpiration(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document = models.OneToOneField(Document, on_delete=models.CASCADE, related_name='expiration')
    expiry_date = models.DateField()
    reminder_sent = models.BooleanField(default=False)
    reminder_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=50, default='pending')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class IncidentReport(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='incident_reports')
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='incident_reports')
    reporting_employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='reported_incidents')
    
    activity_date = models.DateField()
    time = models.TimeField()
    incident_type = models.CharField(max_length=100) # Fall, Injury, Bite, Allergy, Illness, Behaviour
    description = models.TextField()
    action_taken = models.TextField()
    witness = models.CharField(max_length=255, null=True, blank=True)
    follow_up_required = models.BooleanField(default=False)
    severity = models.CharField(max_length=50) # Low, Medium, High, Emergency
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class InspectionVisit(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='inspections')
    inspection_date = models.DateField()
    inspector_name = models.CharField(max_length=255)
    inspection_type = models.CharField(max_length=100) # Routine, Unannounced, Complaint
    pass_fail = models.CharField(max_length=50, null=True, blank=True)
    recommendations = models.TextField(null=True, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class InspectionFinding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    inspection_visit = models.ForeignKey(InspectionVisit, on_delete=models.CASCADE, related_name='findings')
    status = models.CharField(max_length=50) # Compliant, Non-Compliant, Observation
    description = models.TextField()
    severity = models.CharField(max_length=50, default='Low') # Low, Medium, High, Critical
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class CorrectiveAction(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='corrective_actions')
    inspection_finding = models.ForeignKey(InspectionFinding, on_delete=models.CASCADE, null=True, blank=True, related_name='actions')
    task = models.CharField(max_length=255)
    owner = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_corrective_actions')
    due_date = models.DateField(null=True, blank=True)
    priority = models.CharField(max_length=50, default='Medium') # Low, Medium, High, Critical
    completion_status = models.CharField(max_length=50, default='Open') # Open, In Progress, Completed, Verified
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

class AgeGroup(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    daycare = models.ForeignKey(Daycare, on_delete=models.CASCADE, related_name='age_groups')
    name = models.CharField(max_length=255)
    min_age_months = models.IntegerField()
    max_age_months = models.IntegerField()
    description = models.TextField(null=True, blank=True)
    color_label = models.CharField(max_length=50, null=True, blank=True)
    display_order = models.IntegerField(default=0)
    status = models.CharField(max_length=50, default='Active')
    
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_age_groups')
    updated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_age_groups')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = ('daycare', 'name')
        ordering = ['display_order', 'min_age_months']

@receiver(post_save, sender=Daycare)
def seed_default_age_groups(sender, instance, created, **kwargs):
    if created:
        defaults = [
            {'name': 'Infant', 'min_age_months': 0, 'max_age_months': 12, 'display_order': 1},
            {'name': 'Toddler', 'min_age_months': 13, 'max_age_months': 24, 'display_order': 2},
            {'name': 'Preschool', 'min_age_months': 25, 'max_age_months': 36, 'display_order': 3},
            {'name': 'Nursery', 'min_age_months': 37, 'max_age_months': 48, 'display_order': 4},
            {'name': 'Pre-K', 'min_age_months': 49, 'max_age_months': 60, 'display_order': 5},
            {'name': 'Kindergarten', 'min_age_months': 61, 'max_age_months': 72, 'display_order': 6},
        ]
        for idx, item in enumerate(defaults):
            AgeGroup.objects.create(
                daycare=instance,
                name=item['name'],
                min_age_months=item['min_age_months'],
                max_age_months=item['max_age_months'],
                display_order=item['display_order']
            )

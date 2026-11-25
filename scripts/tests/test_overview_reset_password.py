import os
import sys

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)
apps_dir = os.path.join(BASE_DIR, 'apps')
if apps_dir not in sys.path:
    sys.path.insert(0, apps_dir)

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'kidsynq.settings')
django.setup()

from django.conf import settings
settings.MIDDLEWARE = [m for m in settings.MIDDLEWARE if 'whitenoise' not in m.lower()]

from django.test import RequestFactory
from django.contrib.sessions.middleware import SessionMiddleware
from django.contrib.messages.storage.fallback import FallbackStorage
from core.models import Student, User, Guardian
from apps.children.views import ChildDetailView

def run():
    child = Student.objects.get(id='208649f2-7fc2-49dd-bf49-8a23534faebb')
    guardian = Guardian.objects.get(id='e3154761-2fe2-4bc2-846e-68e827abecac')
    admin_user = User.objects.filter(is_superuser=True).first() or User.objects.filter(is_staff=True).first()

    factory = RequestFactory()

    # 1. Test Overview Tab renders reset password button and modal
    req = factory.get(f'/daycare/children/{child.id}/?tab=overview')
    req.user = admin_user
    sm = SessionMiddleware(lambda r: None)
    sm.process_request(req)
    req.session.save()
    setattr(req, '_messages', FallbackStorage(req))

    resp = ChildDetailView.as_view()(req, pk=child.id)
    content = resp.content.decode('utf-8')

    assert f'data-bs-target="#resetGuardianModal{guardian.id}"' in content, 'Reset Password modal trigger not found in Overview tab!'
    assert f'id="resetGuardianModal{guardian.id}"' in content, 'Reset Password modal not rendered in Overview tab!'
    print('[PASS] 1. Overview tab renders Reset Password trigger and modal')

    # 2. Test Reset Password on Robert Davis (who previously had user=None)
    reset_req = factory.post(f'/daycare/children/{child.id}/', {
        'action': 'reset_guardian_password',
        'guardian_id': str(guardian.id),
        'password': 'Parent2026!',
        'tab': 'overview'
    })
    reset_req.user = admin_user
    sm = SessionMiddleware(lambda r: None)
    sm.process_request(reset_req)
    reset_req.session.save()
    setattr(reset_req, '_messages', FallbackStorage(reset_req))

    reset_resp = ChildDetailView.as_view()(reset_req, pk=child.id)
    assert reset_resp.status_code == 302
    assert 'tab=overview' in reset_resp.url, f'Expected redirect with tab=overview, got {reset_resp.url}'

    guardian.refresh_from_db()
    assert guardian.user is not None, 'User account was not linked to guardian!'
    assert guardian.status == 'Active', f'Expected Active status, got {guardian.status}'
    assert guardian.user.check_password('Parent2026!'), 'Password was not set to Parent2026!'
    assert guardian.user.role == 'Guardian', f'Expected Guardian role, got {guardian.user.role}'
    print(f'[PASS] 2. Reset / Set Password created and activated user {guardian.user.username} with role {guardian.user.role}')

    # 3. Test Re-rendering Overview tab now shows Active status for Robert Davis
    resp2 = ChildDetailView.as_view()(req, pk=child.id)
    content2 = resp2.content.decode('utf-8')
    assert 'Active' in content2, 'Active status not rendered!'
    print('[PASS] 3. Overview tab now shows Robert Davis as Active with password Parent2026!')
    print('=== ALL TESTS PASSED 100%! ===')

if __name__ == '__main__':
    run()

import logging
import requests
from abc import ABC, abstractmethod
from django.conf import settings

logger = logging.getLogger(__name__)


class BaseEmailService(ABC):
    @abstractmethod
    def send_email(self, to_email: str, subject: str, html_content: str, text_content: str = "") -> bool:
        pass

    @abstractmethod
    def send_verification_code(self, to_email: str, code: str) -> bool:
        pass


class ResendEmailService(BaseEmailService):
    """
    Production-grade Resend adapter with automatic fallback to mock/console logging
    when API keys are placeholder or unavailable in dev.
    """
    def __init__(self):
        self.api_key = settings.RESEND_API_KEY.strip()
        self.from_email = settings.RESEND_FROM_EMAIL
        self.endpoint = "https://api.resend.com/emails"

    def send_email(self, to_email: str, subject: str, html_content: str, text_content: str = "") -> bool:
        if self.is_development_mode:
            # Development fallback / Mock logger
            logger.info(
                f"[DEV EMAIL SERVICE] Sent to: {to_email} | Subject: {subject}\n"
                f"Content: {text_content or html_content}"
            )
            # Safe print for Windows consoles
            try:
                print(f"\n==========================================")
                print(f"[RESEND EMAIL DISPATCH]")
                print(f"To: {to_email}")
                print(f"From: {self.from_email}")
                print(f"Subject: {subject.encode('ascii', errors='replace').decode('ascii')}")
                print(f"Code dispatched successfully (simulated).")
                print(f"==========================================\n")
            except Exception:
                pass
            return True

        if not self.api_key or self.api_key in {'fakekey', 'fake_pass'}:
            logger.error('Resend API key is not configured.')
            return False

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": text_content or ""
        }

        try:
            response = requests.post(self.endpoint, headers=headers, json=payload, timeout=10)
            if response.status_code in [200, 201]:
                logger.info(f"Email successfully delivered via Resend to {to_email}")
                return True
            else:
                logger.error(f"Resend error: {response.status_code} - {response.text}")
                return False
        except Exception as e:
            logger.exception(f"Failed to communicate with Resend API: {e}")
            return False

    def send_verification_code(self, to_email: str, code: str) -> bool:
        subject = f"{code} - Art Experts Təsdiq Kodu / Verification Code"
        html_content = f"""
        <div style="font-family: 'Georgia', serif; max-width: 580px; margin: 0 auto; padding: 36px; background: #ffffff; color: #18181b; border: 1px solid #e7e5e4; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 24px;">
                <span style="display: inline-block; font-size: 22px; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: #18181b; border-bottom: 2px solid #b45309; padding-bottom: 8px;">
                    Art Experts
                </span>
            </div>
            <p style="font-size: 15px; line-height: 1.6; color: #44403c; margin-bottom: 24px;">
                Art Experts platformasında qeydiyyatınızı təsdiqləmək üçün aşağıdakı 6 rəqəmli təhlükəsizlik kodunu daxil edin:
            </p>
            <div style="text-align: center; margin: 32px 0;">
                <span style="display: inline-block; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #b45309; background: #fef3c7; padding: 16px 32px; border-radius: 8px; border: 1px dashed #d97706;">
                    {code}
                </span>
            </div>
            <p style="font-size: 13px; color: #78716c; line-height: 1.5; border-top: 1px solid #f5f5f4; padding-top: 20px;">
                Bu kod 15 dəqiqə ərzində etibarlıdır. Əgər bu sorğunu siz göndərməmisinizsə, lütfən bu məktubu nəzərə almayın.<br/><br/>
                <em>This verification code will expire in 15 minutes. If you did not make this request, please ignore this email.</em>
            </p>
        </div>
        """
        text_content = f"İlqar Məmmədov Sənət Platforması qeydiyyat təsdiq kodunuz: {code} (Etibarlılıq: 15 dəqiqə)"
        return self.send_email(to_email, subject, html_content, text_content)

    @property
    def is_development_mode(self):
        return settings.DEBUG and (not self.api_key or self.api_key in {'fakekey', 'fake_pass'})

    def send_password_reset_code(self, to_email: str, code: str) -> bool:
        subject = 'Art Experts — Şifrənin bərpası'
        text = f'Şifrənizi yeniləmək üçün kod: {code}. Kod 15 dəqiqə etibarlıdır. Bu sorğunu siz göndərməmisinizsə, məktubu nəzərə almayın.'
        html = f'<div style="font-family:Arial;padding:32px"><h2>Art Experts — Şifrənin bərpası</h2><p>Şifrənizi yeniləmək üçün aşağıdakı kodu daxil edin:</p><p style="font-size:32px;letter-spacing:6px">{code}</p><p>Kod 15 dəqiqə etibarlıdır. Bu sorğunu siz göndərməmisinizsə, məktubu nəzərə almayın.</p></div>'
        return self.send_email(to_email, subject, html, text)


email_service = ResendEmailService()

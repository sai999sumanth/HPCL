import base64
import typing
import pydantic
import urdhva_base
import pydantic.utils
import cryptography.fernet
from pydantic_core import core_schema
from pydantic.json_schema import JsonSchemaValue
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives.kdf.hkdf import HKDF



class Secret(str):

    @classmethod
    def __get_pydantic_json_schema__(cls, _core_schema, handler) -> JsonSchemaValue:
        return handler(core_schema.str_schema())

    @classmethod
    def __modify_schema__(cls, field_schema: typing.Dict[str, typing.Any]) -> None:
        pydantic.utils.update_not_none(field_schema, type='string', writeOnly=True, format='password')

    @classmethod
    def __get_validators__(cls) -> 'typing.CallableGenerator':
        yield cls.validate

    @classmethod
    def get_key(cls, domain=None):
        hkdf = HKDF(
            algorithm=hashes.SHA256(),  # You can swap this out for hashes.MD5()
            length=32,
            salt=None,  # You may be able to remove this line but I'm unable to test
            info=None,  # You may also be able to remove this line
            backend=default_backend()
        )
        if not domain:
            password = urdhva_base.ctx['entity_id'] if urdhva_base.ctx.exists() else "urdhva_secret"
        else:
            password = domain
        return base64.urlsafe_b64encode(hkdf.derive(password.encode()))

    @classmethod
    def validate(cls, value: str, domain: None) -> 'Secret':
        if isinstance(value, cls):
            return value
        if isinstance(value, str) and not value.startswith('enc#_'):
            value = 'enc#_' + cryptography.fernet.Fernet(cls.get_key(urdhva_base.settings.password_salt)).encrypt(
                value.encode()).decode()
            # print("encrypted: ", value)
        return cls(value)

    def __repr__(self) -> str:
        return f"Secret('{self}')"

    def __eq__(self, other: typing.Any) -> bool:
        return isinstance(other, Secret) and self.get_secret() == other.get_secret()

    def get_secret(self, domain=None) -> str:
        # print(self.encode())
        if not self.startswith('enc#_'):
            return str(self)
        return cryptography.fernet.Fernet(self.get_key(urdhva_base.settings.password_salt)).decrypt(
            self[5:].encode()).decode()

import collections
import contextvars
import typing
import copy

_request_scope_context_storage: contextvars.ContextVar[typing.Dict[typing.Any, typing.Any]] = \
    contextvars.ContextVar('urdhva_base-request-scope')


class Context(collections.UserDict):
    """
    A mapping with dict-like interface.
    It is using request context as a data store. Can be used only if context
    has been created in the middleware.
    """

    def __init__(self, *args: typing.Any, **kwargs: typing.Any):  # noqa
        # not calling super on purpose
        if args or kwargs:
            raise AttributeError("Can't instantiate with attributes")

    @property
    def data(self) -> dict:  # type: ignore
        """
        Dump this to json.
        Object itself it not serializable.
        """
        try:
            return _request_scope_context_storage.get()
        except LookupError:
            raise LookupError

    def exists(self) -> bool:
        return _request_scope_context_storage in contextvars.copy_context()

    def copy(self) -> dict:
        return copy.copy(self.data)


context = Context()

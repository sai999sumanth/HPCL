import urdhva_base


class Entity:

    @property
    def id(self):
        return urdhva_base.ctx['domain'].hostname.split('.')[0]

    @property
    def auth(self):
        return "OAUTH"
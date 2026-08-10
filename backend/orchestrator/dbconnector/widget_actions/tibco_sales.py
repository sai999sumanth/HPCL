class TibcoSalesActions:
    def __init__(self):
        self.drill_level = {
            '': {'key': 'zone'},
            'zone': {},
            'state': {},
            'salesarea': {},
            'plant': {},
            'coursol': {}
        }

    @staticmethod
    def get_next_level_drill_params(present_group):
        ...

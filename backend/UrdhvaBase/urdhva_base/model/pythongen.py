import os
import urdhva_base.model.helpers

databases = {
    'mongo': ['urdhva_base.mongomodel', 'urdhva_base.mongomodel.BaseMongoModel', 'urdhva_base.mongomodel.MongoModel'],
    'elastic': ['urdhva_base.elasticmodel', 'urdhva_base.elasticmodel.BaseElasticModel',
                'urdhva_base.elasticmodel.ElasticModel'],
    'postgres': ['urdhva_base.postgresmodel', 'urdhva_base.postgresmodel.BasePostgresModel',
                 'urdhva_base.postgresmodel.PostgresModel', 'urdhva_base.postgrestable']
}


def generate(m):
    fbase = os.path.splitext(os.path.basename(m._tx_model_params['file']))[0]
    db = databases[m._tx_model_params['db']]
    for model in m.models:
        model.dbbase = db
        model.fbase = fbase

    # 1) Generate the enum's in a separate file
    enum_output = urdhva_base.model.helpers.EnumsFile(m.enums).render()
    file_name = f'{fbase}_enum.py'
    with open(file_name, "w") as f:
        f.write(enum_output)

    # 2) Generate the Model's in a separate file
    # model_output = '\n'.join(list(map(lambda x: x.render(), m.models)))
    model_output = urdhva_base.model.helpers.ModelsFile(m.models).render()
    file_name = f'{fbase}_model.py'
    with open(file_name, "w") as f:
        model_output = model_output.splitlines()
        # Fixing pep-8 line spaces in the final model data
        out_put = []
        for line in model_output:
            if line.strip().startswith("class"):
                while not out_put[-1].strip():
                    out_put = out_put[:-1]
                if line.strip().startswith("class Config:"):
                    out_put.extend(["", line])
                else:
                    out_put.extend(["", "", line])
            else:
                if line.strip() == "pass":
                    while not out_put[-1].strip():
                        out_put = out_put[:-1]
                out_put.append(line)
        f.write("\n".join(out_put))

    # 3) Generate the standard API endpoints in a separate file
    std_api_output = urdhva_base.model.helpers.StdApiFile(m.models).render()
    file_name = f'{fbase}_stdapi.py'
    with open(file_name, "w") as f:
        std_api_output = std_api_output.lstrip().splitlines()
        # Fixing pep-8 line spaces in the final model data
        out_put = []
        for line in std_api_output:
            if line.strip().startswith("@router."):
                while not out_put[-1].strip():
                    out_put = out_put[:-1]
                out_put.extend(["", "", line])
            else:
                if line.startswith("  "):
                    while not out_put[-1].strip():
                        out_put = out_put[:-1]
                out_put.append(line)
        f.write("\n".join(out_put))

    # 4) Generate the custom action's in their own files to make the editing easy
    for model in m.models:
        if len(model.actions):
            if os.path.exists(f'{model.name.lower()}_actions.py'):
                with open(f'{model.name.lower()}_actions.py') as f:
                    actions_data = f.read().splitlines()
            else:
                action = model.actions[0]
                action.fbase = fbase
                action.route_name = model.name.lower()

                actions_data = [urdhva_base.model.helpers.ActionBase(action).render()]
            for action in model.actions:
                # This line was to verify present action already available in action file or not
                # to avoid override of data
                if f"# Action {action.name.lower()}" in actions_data:
                    continue
                action.fbase = fbase
                actions_data.extend(["", ""] + action.render().lstrip().splitlines())
            with open(f'{model.name.lower()}_actions.py', "w+") as f:
                f.write("\n".join(actions_data)+"\n")

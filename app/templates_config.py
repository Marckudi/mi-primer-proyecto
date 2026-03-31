from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="app/templates")
templates.env.globals["enumerate"] = enumerate
templates.env.globals["min"] = min
templates.env.globals["max"] = max
templates.env.globals["round"] = round

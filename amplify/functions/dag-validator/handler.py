import ast
import json

def lambda_handler(event, context):
    code = event.get('dagPythonCode', '')
    
    if not code:
        return {"valid": False, "error": "No Python code provided in the payload."}
        
    try:
        ast.parse(code)
        
        if "DAG(" not in code and "@dag" not in code:
            return {"valid": False, "error": "Code is valid Python but does not contain an Airflow DAG definition."}
            
        return {"valid": True}
        
    except SyntaxError as e:
        return {
            "valid": False, 
            "error": f"Syntax Error on line {e.lineno}: {e.msg}\nCode snippet: {e.text}"
        }
    except Exception as e:
        return {
            "valid": False,
            "error": f"Unexpected validation error: {str(e)}"
        }
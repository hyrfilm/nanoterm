type env = (string * string) list

let empty : env = []

let rec env_get (env : env) (name : string) =
  match env with
  | [] -> None
  | (k, v) :: rest -> if k = name then Some v else env_get rest name

let rec env_set (env : env) (name : string) (value : string) =
  match env with
  | [] -> [ (name, value) ]
  | (k, v) :: rest ->
      if k = name then
        (name, value) :: rest
      else
        (k, v) :: env_set rest name value

let to_list (env : env) : (string * string) list =
  env

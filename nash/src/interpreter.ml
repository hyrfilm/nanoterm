open Environment
open Hooks

type token =
  | Word of string
  | Variable of string
  | Equals

type expr =
  | Literal of string
  | Var of string

type word = expr list

type statement =
  | Assignment of string * word
  | Command of word list

let is_space = function
  | ' ' | '\n' | '\t' -> true
  | _ -> false

let is_var_start = function
  | 'a' .. 'z' | 'A' .. 'Z' | '_' -> true
  | _ -> false

let is_var_char = function
  | 'a' .. 'z' | 'A' .. 'Z' | '0' .. '9' | '_' -> true
  | _ -> false

let lex (input : string) : (token list, string) result =
  let len = String.length input in

  let rec skip_spaces i =
    if i < len && is_space input.[i] then skip_spaces (i + 1) else i
  in

  let read_word i =
    let rec loop j =
      if j < len && not (is_space input.[j]) && input.[j] <> '$' && input.[j] <> '=' then
        loop (j + 1)
      else
        j
    in
    let j = loop i in
    (Word (String.sub input i (j - i)), j)
  in

  let read_variable i =
    if i >= len || not (is_var_start input.[i]) then
      Error "Expected variable name after '$'"
    else
      let rec loop j =
        if j < len && is_var_char input.[j] then loop (j + 1) else j
      in
      let j = loop i in
      Ok (Variable (String.sub input i (j - i)), j)
  in

  let rec walk i acc =
    let i = skip_spaces i in
    if i >= len then
      Ok (List.rev acc)
    else
      match input.[i] with
      | '=' ->
          walk (i + 1) (Equals :: acc)
      | '$' ->
          begin
            match read_variable (i + 1) with
            | Error e -> Error e
            | Ok (tok, next_i) -> walk next_i (tok :: acc)
          end
      | _ ->
          let tok, next_i = read_word i in
          walk next_i (tok :: acc)
  in

  walk 0 []

let parse_word (tokens : token list) : (word * token list, string) result =
  let rec loop toks acc =
    match toks with
    | Word s :: rest -> loop rest (Literal s :: acc)
    | Variable name :: rest -> loop rest (Var name :: acc)
    | _ ->
        if acc = [] then
          Error "Expected word"
        else
          Ok (List.rev acc, toks)
  in
  loop tokens []

let parse_statement (tokens : token list) : (statement, string) result =
  match tokens with
  | Word name :: Equals :: rest ->
      begin
        match parse_word rest with
        | Error e -> Error e
        | Ok (value, remaining) ->
            begin
              match remaining with
              | [] -> Ok (Assignment (name, value))
              | _ -> Error "Unexpected tokens after assignment"
            end
      end
  | _ ->
      let rec as_words toks acc =
        match toks with
        | [] -> Ok (Command (List.rev acc))
        | Word s :: rest -> as_words rest ([ Literal s ] :: acc)
        | Variable v :: rest -> as_words rest ([ Var v ] :: acc)
        | Equals :: rest -> as_words rest ([ Literal "=" ] :: acc)
      in
      as_words tokens []

let eval_expr (env : env) (expression : expr) : (string, string) result =
  match expression with
  | Literal s -> Ok s
  | Var name ->
      begin
        match env_get env name with
        | Some value -> Ok value
        | None -> Error ("Undefined variable: " ^ name)
      end

let eval_word (env : env) (w : word) : (string, string) result =
  let rec loop exprs acc =
    match exprs with
    | [] -> Ok (String.concat "" (List.rev acc))
    | expression :: rest ->
        begin
          match eval_expr env expression with
          | Ok value -> loop rest (value :: acc)
          | Error _ as err -> err
        end
  in
  loop w []

let eval_statement (run_command : run_command) (env : env) (stmt : statement)
  : (env, string) result =
  match stmt with
  | Assignment (name, value_word) ->
      begin
        match eval_word env value_word with
        | Error e -> Error e
        | Ok value -> Ok (env_set env name value)
      end
  | Command words ->
      let rec eval_words ws acc =
        match ws with
        | [] -> Ok (List.rev acc)
        | w :: rest ->
            begin
              match eval_word env w with
              | Error e -> Error e
              | Ok s -> eval_words rest (s :: acc)
            end
      in
      begin
        match eval_words words [] with
        | Error e -> Error e
        | Ok argv ->
            run_command argv;
            Ok env
      end

let run_line (run_command : run_command) (env : env) (input : string)
  : (env, string) result =
  match lex input with
  | Error e -> Error e
  | Ok tokens ->
      begin
        match parse_statement tokens with
        | Error e -> Error e
        | Ok stmt -> eval_statement run_command env stmt
      end

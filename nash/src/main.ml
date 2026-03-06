open Environment
open Interpreter

let default_run_command (argv : string list) : unit =
  Printf.printf "run_command: [%s]\n" (String.concat "; " argv)

let rec repl (env : env) : unit =
  print_string "nash> ";
  flush stdout;
  match read_line () with
  | exception End_of_file ->
      print_endline "bye";
      ()
  | line ->
      let trimmed = String.trim line in
      if trimmed = "" then
        repl env
      else
        begin
          match run_line default_run_command env trimmed with
          | Ok next_env -> repl next_env
          | Error message ->
              prerr_endline ("error: " ^ message);
              repl env
        end

let () =
  repl Environment.empty

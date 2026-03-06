open Nash

let fail message =
  prerr_endline message;
  exit 1

let assert_equal_string expected actual context =
  if expected <> actual then
    fail (Printf.sprintf "%s: expected '%s' but got '%s'" context expected actual)

let assert_true condition context =
  if not condition then fail (context ^ ": expected true")

let test_env_get_set () =
  let env = Environment.empty |> fun e -> Environment.env_set e "USER" "guest" in
  match Environment.env_get env "USER" with
  | Some value -> assert_equal_string "guest" value "env_get returns set value"
  | None -> fail "env_get should return Some for existing key";

  let env2 = Environment.env_set env "USER" "root" in
  match Environment.env_get env2 "USER" with
  | Some value -> assert_equal_string "root" value "env_set updates existing value"
  | None -> fail "env_get should return Some after update"

let test_assignment () =
  let env = Environment.empty in
  let no_op _ = () in
  match Interpreter.run_line no_op env "PROJECT=nanoterm" with
  | Error message -> fail ("assignment failed: " ^ message)
  | Ok env2 ->
      begin
        match Environment.env_get env2 "PROJECT" with
        | Some value -> assert_equal_string "nanoterm" value "assignment sets variable"
        | None -> fail "assignment should create variable"
      end

let test_command_hook () =
  let env =
    Environment.empty
    |> fun e -> Environment.env_set e "USER" "guest"
  in
  let captured = ref ([] : string list) in
  let hook argv =
    captured := argv
  in
  match Interpreter.run_line hook env "echo $USER" with
  | Error message -> fail ("command eval failed: " ^ message)
  | Ok _ ->
      begin
        match !captured with
        | [ "echo"; "guest" ] -> ()
        | other ->
            fail (Printf.sprintf "hook argv mismatch: [%s]" (String.concat "; " other))
      end

let test_undefined_variable_error () =
  let captured = ref false in
  let hook _ = captured := true in
  match Interpreter.run_line hook Environment.empty "echo $MISSING" with
  | Ok _ -> fail "expected undefined variable error"
  | Error message ->
      assert_true (String.length message > 0) "undefined variable returns non-empty error";
      assert_true (not !captured) "hook not called on eval error"

let () =
  test_env_get_set ();
  test_assignment ();
  test_command_hook ();
  test_undefined_variable_error ();
  print_endline "nash tests: ok"


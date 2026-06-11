// Back-compat export: storage still exposes the journal note sanitizer, but the
// implementation lives in @iching/core so terminal input scenes share it too.

export { stripTerminalControls } from "@iching/core";

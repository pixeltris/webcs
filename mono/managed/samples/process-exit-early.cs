/*
dotnet csc process-exit-early.cs /r:webcs.exe
process-exit-early
*/
using System;

// This demonstrates that code will keep executing even after a virtual process is closed. This kind of thing combined with async code will produce undesired results.
// In this case "NOT OK!" is invalidly inserted into the next terminal prompt.
class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        p.WriteLine("OK");
        p.Exit();
        p.WriteLine("NOT OK!");
    }
    static void Main(){}
}
/*
dotnet csc main.cs /r:webcs.exe
main --main
main --mainc
*/
using System;

// --main redirects Console.Out so that Console.WriteLine goes to the terminal.
// --mainc doesn't redirect Console.Out and it'll go to the browser console log like normal.
// In both cases it assumes all execution finishes when Main returns, don't use async code (it wont / can't stop async code for you).
class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        p.WriteLine("WebcsMain was called with " + p.Args.Length + " args");
        foreach (string arg in p.Args)
        {
            p.WriteLine("'" + arg + "'");
        }
        p.Exit();
    }
    static void Main(string[] args)
    {
        Console.WriteLine("Main was called with " + args.Length + " args");
        foreach (string arg in args)
        {
            Console.WriteLine("'" + arg + "'");
        }
    }
}
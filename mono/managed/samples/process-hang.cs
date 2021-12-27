/*
dotnet csc process-hang.cs /r:webcs.exe
process-hang
*/
using System;
using System.IO;

// This will keep the terminal control after finishing and you'll need to use Ctrl+C to kill it.
class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        p.OnKill += () =>
        {
            p.WriteLine("Killed");
            Console.WriteLine("Killed");// This will go to the browser console log. If you close the terminal tab this will still occur.
        };
        p.WriteLine("NOT calling p.Exit()");
        p.WriteLine("Use Ctrl+C to kill the process");
        //p.Exit();
    }
    static void Main(){}
}
/*
nuget WebAssembly
mv WebAssembly/netcoreapp3.1/WebAssembly.dll WebAssembly.dll
dotnet csc wasm.cs /r:webcs.exe /r:WebAssembly.dll
wasm
*/

// This demonstrates using the nuget package "WebAssembly" to build WASM and running it via its WASM->IL lifter
// This also demonstrates running the produced WASM directly
// This code was copied (output slightly tweaked) from the README https://github.com/RyanLamansky/dotnet-webassembly

using System;
using System.IO;
using WebAssembly;
using WebAssembly.Instructions;
using WebAssembly.Runtime;
using System.Collections;

// We need this later to call the code we're generating.
public abstract class Sample
{
    // Sometimes you can use C# dynamic instead of building an abstract class like this.
    public abstract int Demo(int value);
}

class Program
{
    static void WebcsMain(WebcsProcess p)
    {
        p.WriteLine("Running 'Demo' (WASM->IL)");
        
        // Module can be used to create, read, modify, and write WebAssembly files.
        var module = new Module(); // In this case, we're creating a new one.

        // Types are function signatures: the list of parameters and returns.
        module.Types.Add(new WebAssemblyType // The first added type gets index 0.
        {
            Parameters = new[]
            {
                WebAssemblyValueType.Int32, // This sample takes a single Int32 as input.
                // Complex types can be passed by sending them in pieces.
            },
            Returns = new[]
            {
                // Multiple returns are supported by the binary format.
                // Standard currently allows a count of 0 or 1, though.
                WebAssemblyValueType.Int32,
            },
        });
        // Types can be re-used for multiple functions to reduce WASM size.

        // The function list associates a function index to a type index.
        module.Functions.Add(new Function // The first added function gets index 0.
        {
            Type = 0, // The index for the "type" value added above.
        });

        // Code must be passed in the exact same order as the Functions above.
        module.Codes.Add(new FunctionBody
        {
            Code = new Instruction[]
            {
                new LocalGet(0), // The parameters are the first locals, in order.
                // We defined the first parameter as Int32, so now an Int32 is at the top of the stack.
                new Int32CountOneBits(), // Returns the count of binary bits set to 1.
                // It takes the Int32 from the top of the stack, and pushes the return value.
                // So, in the end, there is still a single Int32 on the stack.
                new End(), // All functions must end with "End".
                // The final "End" also delivers the returned value.
            },
        });

        // Exports enable features to be accessed by external code.
        // Typically this means JavaScript, but this library adds .NET execution capability, too.
        module.Exports.Add(new Export
        {
            Kind = ExternalKind.Function,
            Index = 0, // This should match the function index from above.
            Name = "Demo", // Anything legal in Unicode is legal in an export name.
        });

        // We now have enough for a usable WASM file, which we could save with module.WriteToBinary().
        // Below, we show how the Compile feature can be used for .NET-based execution.
        // For stream-based compilation, WebAssembly.Compile should be used.
        var instanceCreator = module.Compile<Sample>();

        // Instances should be wrapped in a "using" block for automatic disposal.
        // This sample doesn't import anything, so we pass an empty import dictionary.
        using (var instance = instanceCreator(new ImportDictionary()))
        {
            // FYI, instanceCreator can be used multiple times to create independent instances.
            p.WriteLine(""+instance.Exports.Demo(0)); // Binary 0, result 0
            p.WriteLine(""+instance.Exports.Demo(1)); // Binary 1, result 1,
            p.WriteLine(""+instance.Exports.Demo(42));  // Binary 101010, result 3
        } // Automatically release the WebAssembly instance here.
        
        p.WriteLine("Running 'Demo' (WASM)");
        using (MemoryStream stream = new MemoryStream())
        {
            module.WriteToBinary(stream);
            Action onWasmRunComplete = () =>
            {
                p.WriteLine("Saving as Demo.wasm");
                using (Stream stream = File.Create(Path.Combine(p.CurrentDirectory, "Demo.wasm")))
                {
                    module.WriteToBinary(stream);
                }
                p.WriteLine("Done");
                p.Exit();
            };
            p.RunWasm(stream.ToArray(), $@"
uiTerminalWriteLine({p.TabId}, instance.exports.Demo(0));
uiTerminalWriteLine({p.TabId}, instance.exports.Demo(1));
uiTerminalWriteLine({p.TabId}, instance.exports.Demo(42));", onWasmRunComplete);
        }
        
        p.OnKill += () => {
            p.WriteLine("Process killed (^C)");
        };
    }

    // Main is used to find WebcsMain
    static void Main(){}
}

// If you were to take Demo.wasm and convert it to a byte array you would get the following (which again produces the same result as above)
/*
<script>
var buffer = new Uint8Array([ 0x00, 0x61, 0x73, 0x6D, 0x01, 0x00, 0x00, 0x00, 0x01, 0x06, 0x01, 0x60, 0x01, 0x7F, 0x01, 0x7F, 0x03, 0x02, 0x01, 0x00, 0x07, 0x08, 0x01, 0x04, 0x44, 0x65, 0x6D, 0x6F, 0x00, 0x00, 0x0A, 0x07, 0x01, 0x05, 0x00, 0x20, 0x00, 0x69, 0x0B ]);
WebAssembly.instantiate(buffer).then(result => {
    console.log(result.instance.exports.Demo(0));
    console.log(result.instance.exports.Demo(1));
    console.log(result.instance.exports.Demo(42));
});
</script>
*/

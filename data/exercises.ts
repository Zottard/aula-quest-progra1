import type { Topic } from "~/data/modules";

export interface Bug {
  id: string;
  label: string;
  hint: string;
  explanation: string;
  test: (code: string) => boolean;
  xp: number;
}

export interface Exercise {
  id: string;
  title: string;
  concept: string;
  briefing: string;
  code: string;
  bugs: Bug[];
  boss?: boolean;
  topic: Topic;
}

// Alcance: Programación 1 -> operadores, ciclos for y vectores.
// Nada de archivos, punteros/memoria dinamica, ni objetos/polimorfismo.
export const EXERCISES: Exercise[] = [
  // ---------------- MODULO 1: OPERADORES ----------------
  {
    id: "op1",
    title: "Misión 1 · El impostor (=)",
    concept: "Asignación vs. comparación",
    topic: "operadores",
    briefing: `<p><code>=</code> asigna, <code>==</code> compara. Confundirlos dentro de un <code>if</code> es uno de los bugs más comunes (y más silenciosos): el programa compila igual, y la condición siempre da "verdadera".</p><p><strong>Tu misión:</strong> el programa dice que un chico de 17 es mayor de edad. Encontrá el impostor.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    int edad = 17;
    if (edad = 18) {
        cout << "Sos mayor de edad" << endl;
    } else {
        cout << "Sos menor de edad" << endl;
    }
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "El if usa asignación en vez de comparación",
        hint: "Contá los signos '=' dentro del paréntesis del if. ¿Cuántos necesita una comparación de igualdad?",
        explanation: "if (edad = 18) le asigna 18 a edad y siempre es verdadero. Debe ser if (edad == 18).",
        test: (c) => /if\s*\(\s*edad\s*==\s*18\s*\)/.test(c),
        xp: 50
      }
    ]
  },
  {
    id: "op2",
    title: "Misión 2 · El resto que no cierra",
    concept: "Operador módulo (%) vs. división (/)",
    topic: "operadores",
    briefing: `<p>Para saber si un número es par, hace falta mirar el <strong>resto</strong> de dividirlo por 2, no el cociente. Ese es el trabajo del operador <code>%</code> (módulo), distinto de <code>/</code> (división entera).</p><p><strong>Tu misión:</strong> este programa dice que 7 es par. Encontrá el operador equivocado.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    int numero = 7;
    if (numero / 2 == 0) {
        cout << numero << " es par" << endl;
    } else {
        cout << numero << " es impar" << endl;
    }
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "Usa división en vez de módulo para chequear paridad",
        hint: "¿Qué operador te da el resto de una división, en vez del cociente?",
        explanation: "numero / 2 == 0 es división entera y casi siempre da falso. Para paridad se usa numero % 2 == 0.",
        test: (c) => /if\s*\(\s*numero\s*%\s*2\s*==\s*0\s*\)/.test(c),
        xp: 50
      }
    ]
  },

  // ---------------- MODULO 2: CICLOS FOR ----------------
  {
    id: "cy1",
    title: "Misión 3 · El bucle que nunca termina",
    concept: "Las tres partes del for",
    topic: "ciclos",
    briefing: `<p>Un <code>for</code> tiene tres partes: inicialización, condición de corte, e incremento. Si te olvidás del incremento, la condición nunca cambia y el programa queda colgado para siempre.</p><p><strong>Tu misión:</strong> este for se cuelga. Completá la tercera parte.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 0; i < 5; ) {
        cout << "Iteracion: " << i << endl;
    }
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "Al for le falta el incremento de 'i'",
        hint: "La tercera parte del for, después del segundo punto y coma, es donde va el incremento.",
        explanation: "for (int i = 0; i < 5; ) deja vacía la parte de incremento. Hace falta for (int i = 0; i < 5; i++).",
        test: (c) => /for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*5\s*;\s*i\s*(\+\+|\+=\s*1)\s*\)/.test(c),
        xp: 55
      }
    ]
  },
  {
    id: "cy2",
    title: "Misión 4 · La cuenta regresiva rota",
    concept: "Condición de corte con decremento",
    topic: "ciclos",
    briefing: `<p>No todos los <code>for</code> cuentan para arriba. Cuando el ciclo decrece, la condición de corte tiene que ir en la dirección correcta, o nunca se cumple.</p><p><strong>Tu misión:</strong> esta cuenta regresiva desde 5 no imprime nada. Encontrá la condición rota.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    for (int i = 5; i > 10; i--) {
        cout << i << endl;
    }
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "La condición de corte nunca se cumple al empezar en 5",
        hint: "i arranca en 5. ¿5 es mayor que 10? La condición decide si el ciclo arranca siquiera.",
        explanation: "i > 10 es falsa desde el principio (5 no es mayor que 10), así que el for nunca entra. Debe ser i > 0 para que la cuenta regresiva funcione.",
        test: (c) => /for\s*\(\s*int\s+i\s*=\s*5\s*;\s*i\s*>\s*0\s*;\s*i\s*--\s*\)/.test(c),
        xp: 55
      }
    ]
  },

  // ---------------- MODULO 3: VECTORES ----------------
  {
    id: "ve1",
    title: "Misión 5 · El desborde silencioso",
    concept: "Recorrer un vector con for",
    topic: "vectores",
    briefing: `<p>Un vector de tamaño N tiene índices válidos de <code>0</code> a <code>N-1</code>. El compilador no avisa si te pasás del límite: en C++ eso es "comportamiento indefinido", no un error visible.</p><p><strong>Tu misión:</strong> este programa suma un vector de 5 números pero se pasa de rango. Corregilo.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    int numeros[5] = {10, 20, 30, 40, 50};
    int suma = 0;
    for (int i = 0; i <= 5; i++) {
        suma += numeros[i];
    }
    cout << "Suma: " << suma << endl;
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "La condición del for permite un índice inválido",
        hint: "Un vector de 5 elementos tiene índices 0,1,2,3,4. ¿Qué operador de comparación evita llegar a 5?",
        explanation: "i <= 5 hace que i llegue a valer 5, un índice que no existe en un vector de tamaño 5.",
        test: (c) => /for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*5\s*;/.test(c),
        xp: 60
      }
    ]
  },
  {
    id: "ve2",
    title: "Misión 6 · La búsqueda que se rinde",
    concept: "Búsqueda lineal en un vector",
    topic: "vectores",
    briefing: `<p>Buscar un valor en un vector significa revisar posición por posición <strong>hasta encontrarlo o terminar el vector</strong>. Cortar la búsqueda apenas una posición no coincide es un error clásico.</p><p><strong>Tu misión:</strong> esta función debería encontrar el 30, pero devuelve que no está. Encontrá por qué se rinde tan rápido.</p>`,
    code: `#include <iostream>
using namespace std;

int main() {
    int numeros[5] = {10, 20, 30, 40, 50};
    int objetivo = 30;
    int encontrado = -1;

    for (int i = 0; i < 5; i++) {
        if (numeros[i] != objetivo) {
            encontrado = -1;
            break;
        }
        encontrado = i;
    }

    cout << "Indice: " << encontrado << endl;
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "El for corta la búsqueda en el primer elemento que no coincide",
        hint: "El bug corta el for con 'break' apenas la primera posición no es el objetivo. La búsqueda tiene que seguir revisando las demás posiciones.",
        explanation: "El if compara con != y corta con break en la primera posición que no coincide. Hay que comparar con == y guardar el índice solo cuando SÍ coincide, dejando que el for siga.",
        test: (c) =>
          /for\s*\(\s*int\s+i\s*=\s*0\s*;\s*i\s*<\s*5\s*;\s*i\s*(\+\+|\+=\s*1)\s*\)\s*\{[\s\S]*?if\s*\(\s*numeros\[i\]\s*==\s*objetivo\s*\)/.test(
            c
          ) && !/break\s*;/.test(c),
        xp: 65
      }
    ]
  },

  // ---------------- JEFE FINAL ----------------
  {
    id: "boss",
    title: "Misión 7 (jefe) · Búsqueda binaria rota",
    concept: "Combinación: operadores + ciclos + vectores",
    topic: "vectores",
    boss: true,
    briefing: `<p>Última misión: una búsqueda binaria en un vector ordenado, con <strong>dos bugs</strong> mezclados de las misiones anteriores. Esto es lo que se siente debuggear código real: los errores no vienen etiquetados ni de a uno.</p><p><strong>Tu misión:</strong> la función debería devolver el índice de "objetivo" dentro del vector ordenado. Encontrá los dos problemas.</p>`,
    code: `#include <iostream>
using namespace std;

int busquedaBinaria(int arr[], int n, int objetivo) {
    int izquierda = 0;
    int derecha = n;
    while (izquierda < derecha) {
        int medio = (izquierda + derecha) / 2;
        if (arr[medio] = objetivo) {
            return medio;
        } else if (arr[medio] < objetivo) {
            izquierda = medio + 1;
        } else {
            derecha = medio - 1;
        }
    }
    return -1;
}

int main() {
    int numeros[6] = {2, 5, 8, 12, 16, 23};
    int resultado = busquedaBinaria(numeros, 6, 12);
    cout << "Encontrado en indice: " << resultado << endl;
    return 0;
}`,
    bugs: [
      {
        id: "b1",
        label: "El límite derecho inicial permite un índice fuera de rango",
        hint: "n es la cantidad de elementos. El último índice válido es n-1, no n.",
        explanation: "int derecha = n; debería ser int derecha = n - 1; para no apuntar fuera del vector.",
        test: (c) => /int\s+derecha\s*=\s*n\s*-\s*1\s*;/.test(c),
        xp: 70
      },
      {
        id: "b2",
        label: "La comparación clave usa asignación en vez de igualdad",
        hint: "Mismo problema que en la misión 1: contá los signos '=' en el if.",
        explanation: "if (arr[medio] = objetivo) asigna en vez de comparar. Debe ser if (arr[medio] == objetivo).",
        test: (c) => /if\s*\(\s*arr\[medio\]\s*==\s*objetivo\s*\)/.test(c),
        xp: 70
      }
    ]
  }
];

\version "2.16.0"

\header {
  title = "Sonate 16 in C major"
  subtitle = "Sonata facile"
  composer = "W. A. Mozart"
  opus = "K 545"
  piece = "Allegro"
  mutopiatitle = "Sonata Facile - First movement"
  mutopiacomposer = "MozartWA"
  mutopiainstrument = "Piano"
  style = "Classical"
  copyright = "Creative Commons Attribution-ShareAlike 3.0"
  source = "IMSLP"
  maintainer = "Alejandro Sierra"
  maintainerEmail = "algsierra@gmail.com"

 footer = "Mutopia-2013/09/01-998"
 tagline = \markup { \override #'(box-padding . 1.0) \override #'(baseline-skip . 2.7) \box \center-column { \abs-fontsize #10 \line { Sheet music from \with-url #"http://www.MutopiaProject.org" \line { \concat { \abs-fontsize #8 www. \abs-fontsize #11 MutopiaProject \abs-fontsize #8 .org } \hspace #0.5 } • \hspace #0.5 \italic Free to download, with the \italic freedom to distribute, modify and perform. } \line { \abs-fontsize #10 \line { Typeset using \with-url #"http://www.LilyPond.org" \line { \concat { \abs-fontsize #8 www. \abs-fontsize #11 LilyPond \abs-fontsize #8 .org }} by \concat { \maintainer . } \hspace #0.5 Copyright © 2013. \hspace #0.5 Reference: \footer } } \line { \abs-fontsize #8 \line { Licensed under the Creative Commons Attribution-ShareAlike 3.0 (Unported) License, for details \concat { see: \hspace #0.3 \with-url #"http://creativecommons.org/licenses/by-sa/3.0" http://creativecommons.org/licenses/by-sa/3.0 } } } } }
}
  
%{ Abreviations
  Suffixes rh = right hand
           lh = left hand
  Prefixes pt = principal theme
           st = secondary theme
           cl = close
           dv = development
           cd = coda
           mt = middle theme
%}

#(define afterGraceFraction (cons 15 16))

%%% Right Hand

ptrha = \relative c'' {  
  c2-1(\mp e4-3 g-5 
  b,4.-1_> c16 d c4) r4
  a'2-3(_\accent g4\< c\!
  g-3_\accent f8\trill\> e16 f e4)\! r4 % \break
  
  a,8\p\<\( b16 c d-1 e f g\!  a\> g f e d c-4 b a\! 
  g8\< a16 b c-1 d e f\!  g\> f e d c \tag #'first b-4 \tag #'second b-3 a g\!
  f8\< g16 a b-1 c d e\!  f\> e d c \tag #'first {b a-4 g f\!} \tag #'second {b-3 a g f-2\!}

  e8\< f16 g  a-1 b c d\!  e\> d c b a \tag #'first g-4 \tag #'second g-3 f e\!\)
}

ptrhb = \relative c'' {  
  b8->\f( g')  e-.-3 c-.-1  d-2( g)  e-. c-.
  d4-. <b d g>-. g-.-2 r4
}

ptrh = {
  \ptrha

  \relative c' {  
    d8\p\( e16 f  g-1 a b cis    d a\< b cis d-1 e f g\! 
    a b c! b  a g f-3 e  f g a g  f e d c!-2 \)
  }
  
  \ptrhb
}

strha = \relative c' {  
  r1
  d''8\mp( b) g4.( a16 b a8 g)
  \acciaccatura a8 g8.\trill-3( fis16-.-2) fis4-3 r2
  d'8\mp( b) g4.( a16 b a8 g)

  \acciaccatura a8 g8.\trill-3( fis16) fis4 r2
}

strhb = \relative c'' {  
  d'4->-5 r16 d16-5 b-4 g-2 e4-1 r16 e16(-1 g-2 e)
  c'4-> r16 c( a fis d4) 
}

strhc = \relative c'' {  
  r16 d16( fis d)
  % 20
  b'4->-5 r16 b( g e c4) r16 c( e c
  a'4->-5) r16 a-5( fis-4 d-2 b4)  r16 g'-5( d-3 b-2
}

strh = {
  \strha
  \strhb
  \strhc
  \relative c'' {  
    a2\p) \acciaccatura b8-2 c4-.-3\< \acciaccatura dis8-2 e4-.-3\!

    \acciaccatura { gis8-2 } a4.-> b32( a gis a c8-5 a-3) c( a)
    b-3(\f g-1) d'2-5(\sf c16 b a g)

    \phrasingSlurDown    
    \acciaccatura b8-3 \afterGrace a1 \startTrillSpan \( ( {g16 [ a ] )
							    \stopTrillSpan}
     g4\) g16-2( d g b-4 d-5 b-4 g b-4 c-5 a-3 fis-2 a-4
     g4-.) g,16-2( d g b-4 d_> b-4 g b-4 c-> a-3 fis-2 a-4
     g4-.) <d' b'>-. <b g'-4>-. r4
   }
}

dvrh = \relative c'' {  
  g4-. g'16-2( d g bes-3 d-5 bes-3 g bes c-5 a-3 fis-2 a-4
  g4-.) g,16-2_( d g bes-3 d bes-3 g bes  c-5 a-3 fis-2 a-4
  g4-.) r r16 g'-2 bes-4 a g f e-4 d 
  
  cis4-.\sf r r16 cis'-3( e d  cis bes a g-3 
  f4\sf)  d16-2( a-1 d f-4 a f-4 d-2 f g-5 e-3 cis-2 e-4
  d4-.) d,16-2 a d f-4  a f d-2 f  g-5 e-3 cis e

  r16 d-1( e f  g-1 a b cis d4-.\sf) r4
  r16 b-1( c d e-1 fis gis a b4-.\sf) r
  r16 a-1( e'-5 d c b a g f4-.\sf) r

  r16 g-1( d'-5 c b a g f-3 e4-.\sf) r
  r16 f-1( c'-5 b a g f e-3 d4-.\sf) r
  r16 e-1( b'-5 a gis f e d-3 c4-.\sf) r
  \break
  r16 bes-3 d c  bes a g f-3  e\> f-1 g a  bes c-1 d e\!
}

ptirh = \relative c'' {
  a'4-. r r <c, a'-5>-.
  <c g'-4>-. r r <c g'-5>-.
  <c f-4>-. r r <b f'-5>-.
  <c-2 e-4>-. r r <c e>-.

  d16-5\( d, e f  g a b cis  d a-1 b cis  d-1 e f g-1
  a b c b  a g f e  f g a g  f e d c-2\)

  \ptrhb
}

stvrh = {
  \transpose c f, { \strhb } 
  \transpose d g { 
    \strhc
     \relative c'' {  
       a2\p) \acciaccatura gis8-2 a4-. \acciaccatura gis8 a4-.
     }
  } 
  \relative c''' {  
    a2\p \acciaccatura gis8-2 a4-. \acciaccatura gis8 a4-.
    
    g8-1\f( a16 b c-1 d e d c b-4 a g  f e-3d c)

    \phrasingSlurDown
    \acciaccatura e8-3 \afterGrace d1 \startTrillSpan \( ({c16[ d])
							   \stopTrillSpan}
    \phrasingSlurUp
    c4-.\) c16-2\( g_> c e-4  g e-4 c e-4  f_> d-3 b d-3 c4-.
    c,16-2 g-> c e-4  g e-4 c e-4  f-> d-3 b d-3\)
    c4-. <e'-1 g-2 c-5>-. c-2 r 

  }
}


%%% Left Hand

ptlha = \relative c'' {  
  c,8-5(\p g'-1 e-3 g  c,  g' e g)
  d-4 g-1 f-2 g  c,-5 g'-1 e-3 g
  c, a'-1 f-2 a  c, g'-1 e-3 g
  b,-5 g'-1 d-3 g  c,-4 g'-1 e-2 g
  
  f4 r4 r4 \clef bass <f, c'>_4-.
  <e c'>-. r4 r4 <e c'>_4-.
  <d c'>-. r4 r4 <d b'>_4-.  
}

ptlhb = \relative c' {  
  g,16-5\( b-4 d-2 g  g,-5 c-3 e-2 g  g, b d g  g, c e g  
  g,4-.\) g'-. g,-. r
}

ptlh = {
  \ptlha
  \relative c {  
    <c c'>-. r4 r4 <c-5 e-3>-.
    <f-2 a-1>1
    f4._3( g8 a4. fis8_2)
  }
  \ptlhb
}

stlha = \relative c {  
  cis'16->\p-2( d cis d  cis d cis d  c_2-> d c d  c d c d)

  b->_3 d b d \repeat unfold 3 { b d b d }
  c-2\mp d b-3 d  a-4 d b-3 d  c d b d  c d a d
  \repeat unfold 4 { b d b d }

  c d b d  a d b d  c d b d  c d a d
}

stlhb = \relative c' {  
  \clef treble r16 b-5( d-4 g-2 b4) r16 c,-5( e-4 g-2 c4)
  r16 a,-5( c-4 fis-2 a4) r16 b,-5( d-4 fis-2 b4)
}

stlhc = \relative c' {  
  % 20
  r16 g-5( b-4 e-2 g4) r16 a,-5( c-4 e-2 a4)
  r16 fis,-5( a-4 d-2 fis4) r16 g,-5( b-4 d-2 g4)
}

stlh = {
  \stlha
  \stlhb
  \stlhc
  \relative c' {
    \clef treble \repeat unfold 16 <c e>8-.

    d16_5 b'_1 g_2 b \repeat unfold 3 { d, b' g b } 
    \repeat unfold 4 { d, c' fis, c' }

    <g-2 b-1>4 r r <a c d,>
    <g-2 b-1> r r \clef bass <d, a' c>
    <g b> <g g,> <g g,> r  
  }
}

dvlha = \relative c' { r16 g_5( a bes  c d e-3 fis g4-.\sf) r }

dvlh = \relative c {
  <g g'>4 r r \clef treble <d'' a' c>(
  <g-3 bes-1>) r r \clef bass <d, a' c>
  \dvlha
  \transpose c d \dvlha
  <d, d'>4 r r \clef treble <a'' e' g>(
  <d-3 f-1>4-.) r r \clef bass <a, e' g>(

  <d_5 f_4>4-.) r r16 d'-3( f e d c-1 b a
  gis4-.)\sf r r16 gis-3( b a gis f!-1 e d
  c4-.)\sf r \clef treble r16 d'-5( a'-1 g f e-1 d c
  \break

  b4-.\sf) r r16 c-5( g' f  e d-1 c b 
  a4-.\sf) r r16 b-5( f' e  d c-1 b a
  \clef bass gis4-.\sf) r r16 a-3( c-1 b  a g-1 f e
  
  d2\sf) <c g' bes>\sf
}
  
ptilha = \relative c {
  f8-5 g16 a  bes c d-3 e f e d-1 c  bes a-1 g f
}

ptilh = \relative c {
  <f f'>4-. r4 r2
  f8-5\( g16 a  bes c d-3 e f e d-1 c  bes a-1 g f  % \ptilha
  e8 f16 g  a b-4 c d  e d c b  a-1 g f e
  d8 e16 f  g a b-3 c  d c b a  g-1 f e d
  \transpose f c { \ptilha }
  
  \once \set fingeringOrientations = #'(right)
  <f-2 a-1>1\p\) 
  f4.-3 g8 a4. fis8-2

  \ptlhb
}

stvlh = {
  \transpose c f, { \stlhb } 
  \transpose d g { \stlhc } 
  \relative c' {  
    r8 \repeat unfold 7 { <f a>8-. }
    \clef bass r8 \repeat unfold 7 { <fis, c' ees>8-. }
    \repeat unfold 4 { g16-5 e' c-2 e }
    \repeat unfold 4 { g,16 f' b, f' }
    <c-2 e-1>4-. r r <g  d' f>(
    \slurDown
    <c_3 e_1>-.) r r <g, d' f>(
    <c e>) <c c'>-. <c c,> r
  }
}



upperWritten = {
  \keepWithTag #'first { \ptrh \strh }
  \dvrh \phrasingSlurUp
  \keepWithTag #'second \transpose c f { \ptrha }
  \ptirh \transpose d g, { \strha } \stvrh
}
lowerWritten = {
  \ptlh \stlh \dvlh
  \clef treble \transpose c f { \ptlha }
  \ptilh \clef treble \transpose c f { \stlha } \stvlh
}

#(use-modules (lily display-lily))
#(memoize-clef-names supported-clefs)
#(define (main-len mus) (ly:moment-main (ly:music-length mus)))
#(define (flat-music mus)
  (let ((name (ly:music-property mus 'name)))
    (cond
      ((eq? name 'UnfoldedRepeatedMusic)
       (append-map
         (lambda (_) (flat-music (ly:music-deep-copy (ly:music-property mus 'element))))
         (iota (ly:music-property mus 'repeat-count))))
      ((memq name '(RelativeOctaveMusic TransposedMusic UnrelativableMusic))
       (flat-music (ly:music-property mus 'element)))
      ((and (eq? name 'SequentialMusic) (> (main-len mus) 0))
       (append-map flat-music (ly:music-property mus 'elements)))
      (else (list mus)))))
#(define (emit-flat label mus)
   (format #t "BEGIN_~a\n" label)
   (let loop ((elements (flat-music mus)) (measure 1) (total 0))
     (if (null? elements)
       (begin
         (if (not (= total 0)) (ly:error "Partial final measure: ~a" total))
         (if (not (= measure 74)) (ly:error "Expected 73 measures; got ~a" (- measure 1))))
       (let* ((m (car elements))
              (duration (main-len m))
              (next-total (+ total duration))
              (text (music->lily-string m)))
         (if (> next-total 1) (ly:error "Element crosses bar ~a at ~a: ~a" measure total text))
         (if (string-contains text "Print method not implemented")
             (ly:error "Unserializable music: ~a" text))
         (format #t "~a\n" text)
         (if (= next-total 1)
           (begin
             (if (memv measure '(28 73)) (format #t "\\bar \":|.\"\n"))
             (format #t "% bar ~a\n" measure)
             (if (= measure 28) (format #t "\\bar \".|:\"\n"))
             (loop (cdr elements) (+ measure 1) 0))
           (loop (cdr elements) measure next-total)))))
   (format #t "END_~a\n" label))
#(define (emit-units label mus)
   (format #t "BEGIN_UNITS_~a\n" label)
   (for-each
    (lambda (m)
      (format #t "UNIT\t~a\t~a\t~a\n"
        (ly:music-property m 'name)
        (main-len m)
        (if (pair? (extract-named-music m 'NoteEvent)) 1 0))
      (display (music->lily-string m))
      (format #t "\nEND_UNIT\n"))
    (flat-music mus))
   (format #t "END_UNITS_~a\n" label))
\version "2.26.0"
\header { title = "Mozart K.545 I Allegro" copyright = "CC BY-SA 3.0; Alejandro Sierra / Mutopia Project" }
% Prepared natively from Mutopia-2013/09/01-998. Written order; volta bodies occur once.
upperMusic = {
\clef treble \key c \major \time 4/4
c''2-1(\mp
e''4-3
g''4-5
% bar 1
b'4.-1_>
c''16
d''16
c''4)
r4
% bar 2
a''2-3(_>
g''4\<
c'''4\!
% bar 3
g''4-3_>
f''8\trill\>
e''16
f''16
e''4)\!
r4
% bar 4
a'8\p\<\(
b'16
c''16
d''16-1
e''16
f''16
g''16\!
a''16\>
g''16
f''16
e''16
d''16
c''16-4
b'16
a'16\!
% bar 5
g'8\<
a'16
b'16
c''16-1
d''16
e''16
f''16\!
g''16\>
f''16
e''16
d''16
c''16
\tag #'first b'16-4
a'16
g'16\!
% bar 6
f'8\<
g'16
a'16
b'16-1
c''16
d''16
e''16\!
f''16\>
e''16
d''16
c''16
b'16
a'16-4
g'16
f'16\!
% bar 7
e'8\<
f'16
g'16
a'16-1
b'16
c''16
d''16\!
e''16\>
d''16
c''16
b'16
a'16
\tag #'first g'16-4
f'16
e'16\!\)
% bar 8
d'8\p\(
e'16
f'16
g'16-1
a'16
b'16
cis''16
d''16
a'16\<
b'16
cis''16
d''16-1
e''16
f''16
g''16\!
% bar 9
a''16
b''16
c'''!16
b''16
a''16
g''16
f''16-3
e''16
f''16
g''16
a''16
g''16
f''16
e''16
d''16
c''!16-2\)
% bar 10
b'8->\f(
g''8)
e''8-.-3
c''8-.-1
d''8-2(
g''8)
e''8-.
c''8-.
% bar 11
d''4-.
< b' d'' g'' >4-.
g'4-.-2
r4
% bar 12
r1
% bar 13
d'''8\mp(
b''8)
g''4.(
a''16
b''16
a''8
g''8)
% bar 14
\acciaccatura a''8
g''8.\trill-3(
fis''16-.-2)
fis''4-3
r2
% bar 15
d'''8\mp(
b''8)
g''4.(
a''16
b''16
a''8
g''8)
% bar 16
\acciaccatura a''8
g''8.\trill-3(
fis''16)
fis''4
r2
% bar 17
d'''4->-5
r16
d'''16-5
b''16-4
g''16-2
e''4-1
r16
e''16(-1
g''16-2
e''16)
% bar 18
c'''4->
r16
c'''16(
a''16
fis''16
d''4)
r16
d''16(
fis''16
d''16)
% bar 19
b''4->-5
r16
b''16(
g''16
e''16
c''4)
r16
c''16(
e''16
c''16
% bar 20
a''4->-5)
r16
a''16-5(
fis''16-4
d''16-2
b'4)
r16
g''16-5(
d''16-3
b'16-2
% bar 21
a'2\p)
\acciaccatura b'8-2
c''4-.-3\<
\acciaccatura dis''8-2
e''4-.-3\!
% bar 22
\acciaccatura { gis''8-2 }
a''4.->
b''32(
a''32
gis''32
a''32
c'''8-5
a''8-3)
c'''8(
a''8)
% bar 23
b''8-3(\f
g''8-1)
d'''2-5(\sf
c'''16
b''16
a''16
g''16)
% bar 24
\override PhrasingSlur.direction = #-1

\acciaccatura b''8-3
\afterGrace 15/16 a''1\startTrillSpan\(( { g''16[ a''16])\stopTrillSpan }
% bar 25
g''4\)
g''16-2(
d''16
g''16
b''16-4
d'''16-5
b''16-4
g''16
b''16-4
c'''16-5
a''16-3
fis''16-2
a''16-4
% bar 26
g''4-.)
g'16-2(
d'16
g'16
b'16-4
d''16_>
b'16-4
g'16
b'16-4
c''16->
a'16-3
fis'16-2
a'16-4
% bar 27
g'4-.)
< d'' b'' >4-.
< b' g''-4 >4-.
r4
\bar ":|."
% bar 28
\bar ".|:"
g'4-.
g''16-2(
d''16
g''16
bes''16-3
d'''16-5
bes''16-3
g''16
bes''16
c'''16-5
a''16-3
fis''16-2
a''16-4
% bar 29
g''4-.)
g'16-2_(
d'16
g'16
bes'16-3
d''16
bes'16-3
g'16
bes'16
c''16-5
a'16-3
fis'16-2
a'16-4
% bar 30
g'4-.)
r4
r16
g''16-2
bes''16-4
a''16
g''16
f''16
e''16-4
d''16
% bar 31
cis''4-.\sf
r4
r16
cis'''16-3(
e'''16
d'''16
cis'''16
bes''16
a''16
g''16-3
% bar 32
f''4\sf)
d''16-2(
a'16-1
d''16
f''16-4
a''16
f''16-4
d''16-2
f''16
g''16-5
e''16-3
cis''16-2
e''16-4
% bar 33
d''4-.)
d'16-2
a16
d'16
f'16-4
a'16
f'16
d'16-2
f'16
g'16-5
e'16-3
cis'16
e'16
% bar 34
r16
d'16-1(
e'16
f'16
g'16-1
a'16
b'16
cis''16
d''4-.\sf)
r4
% bar 35
r16
b'16-1(
c''16
d''16
e''16-1
fis''16
gis''16
a''16
b''4-.\sf)
r4
% bar 36
r16
a''16-1(
e'''16-5
d'''16
c'''16
b''16
a''16
g''16
f''4-.\sf)
r4
% bar 37
r16
g''16-1(
d'''16-5
c'''16
b''16
a''16
g''16
f''16-3
e''4-.\sf)
r4
% bar 38
r16
f''16-1(
c'''16-5
b''16
a''16
g''16
f''16
e''16-3
d''4-.\sf)
r4
% bar 39
r16
e''16-1(
b''16-5
a''16
gis''16
f''16
e''16
d''16-3
c''4-.\sf)
r4
% bar 40
\break
r16
bes'16-3
d''16
c''16
bes'16
a'16
g'16
f'16-3
e'16\>
f'16-1
g'16
a'16
bes'16
c''16-1
d''16
e''16\!
% bar 41
\override PhrasingSlur.direction = #1

f''2-1(\mp
a''4-3
c'''4-5
% bar 42
e''4.-1_>
f''16
g''16
f''4)
r4
% bar 43
d'''2-3(_>
c'''4\<
f'''4\!
% bar 44
c'''4-3_>
bes''8\trill\>
a''16
bes''16
a''4)\!
r4
% bar 45
d''8\p\<\(
e''16
f''16
g''16-1
a''16
bes''16
c'''16\!
d'''16\>
c'''16
bes''16
a''16
g''16
f''16-4
e''16
d''16\!
% bar 46
c''8\<
d''16
e''16
f''16-1
g''16
a''16
bes''16\!
c'''16\>
bes''16
a''16
g''16
f''16
\tag #'second e''16-3
d''16
c''16\!
% bar 47
bes'8\<
c''16
d''16
e''16-1
f''16
g''16
a''16\!
bes''16\>
a''16
g''16
f''16
e''16-3
d''16
c''16
bes'16-2\!
% bar 48
a'8\<
bes'16
c''16
d''16-1
e''16
f''16
g''16\!
a''16\>
g''16
f''16
e''16
d''16
\tag #'second c''16-3
bes'16
a'16\!\)
% bar 49
a''4-.
r4
r4
< c'' a''-5 >4-.
% bar 50
< c'' g''-4 >4-.
r4
r4
< c'' g''-5 >4-.
% bar 51
< c'' f''-4 >4-.
r4
r4
< b' f''-5 >4-.
% bar 52
< c''-2 e''-4 >4-.
r4
r4
< c'' e'' >4-.
% bar 53
d''16-5\(
d'16
e'16
f'16
g'16
a'16
b'16
cis''16
d''16
a'16-1
b'16
cis''16
d''16-1
e''16
f''16
g''16-1
% bar 54
a''16
b''16
c'''16
b''16
a''16
g''16
f''16
e''16
f''16
g''16
a''16
g''16
f''16
e''16
d''16
c''16-2\)
% bar 55
b'8->\f(
g''8)
e''8-.-3
c''8-.-1
d''8-2(
g''8)
e''8-.
c''8-.
% bar 56
d''4-.
< b' d'' g'' >4-.
g'4-.-2
r4
% bar 57
r1
% bar 58
g''8\mp(
e''8)
c''4.(
d''16
e''16
d''8
c''8)
% bar 59
\acciaccatura d''8
c''8.\trill-3(
b'16-.-2)
b'4-3
r2
% bar 60
g''8\mp(
e''8)
c''4.(
d''16
e''16
d''8
c''8)
% bar 61
\acciaccatura d''8
c''8.\trill-3(
b'16)
b'4
r2
% bar 62
g''4->-5
r16
g''16-5
e''16-4
c''16-2
a'4-1
r16
a'16(-1
c''16-2
a'16)
% bar 63
f''4->
r16
f''16(
d''16
b'16
g'4)
r16
g''16(
b''16
g''16)
% bar 64
e'''4->-5
r16
e'''16(
c'''16
a''16
f''4)
r16
f''16(
a''16
f''16
% bar 65
d'''4->-5)
r16
d'''16-5(
b''16-4
g''16-2
e''4)
r16
c'''16-5(
g''16-3
e''16-2
% bar 66
d''2\p)
\acciaccatura cis''8-2
d''4-.
\acciaccatura cis''8
d''4-.
% bar 67
a''2\p
\acciaccatura gis''8-2
a''4-.
\acciaccatura gis''8
a''4-.
% bar 68
g''8-1\f(
a''16
b''16
c'''16-1
d'''16
e'''16
d'''16
c'''16
b''16-4
a''16
g''16
f''16
e''16-3
d''16
c''16)
% bar 69
\override PhrasingSlur.direction = #-1

\acciaccatura e''8-3
\afterGrace 15/16 d''1\startTrillSpan\(( { c''16[ d''16])\stopTrillSpan }
% bar 70
\override PhrasingSlur.direction = #1

c''4-.\)
c''16-2\(
g'16_>
c''16
e''16-4
g''16
e''16-4
c''16
e''16-4
f''16_>
d''16-3
b'16
d''16-3
% bar 71
c''4-.
c'16-2
g16->
c'16
e'16-4
g'16
e'16-4
c'16
e'16-4
f'16->
d'16-3
b16
d'16-3\)
% bar 72
c'4-.
< e''-1 g''-2 c'''-5 >4-.
c''4-2
r4
\bar ":|."
% bar 73

}
lowerMusic = {
\clef treble \key c \major \time 4/4
c'8-5(\p
g'8-1
e'8-3
g'8
c'8
g'8
e'8
g'8)
% bar 1
d'8-4
g'8-1
f'8-2
g'8
c'8-5
g'8-1
e'8-3
g'8
% bar 2
c'8
a'8-1
f'8-2
a'8
c'8
g'8-1
e'8-3
g'8
% bar 3
b8-5
g'8-1
d'8-3
g'8
c'8-4
g'8-1
e'8-2
g'8
% bar 4
f'4
r4
r4
\clef "bass"

< f c' >4_4-.
% bar 5
< e c' >4-.
r4
r4
< e c' >4_4-.
% bar 6
< d c' >4-.
r4
r4
< d b >4_4-.
% bar 7
< c c' >4-.
r4
r4
< c-5 e-3 >4-.
% bar 8
< f-2 a-1 >1
% bar 9
f4._3(
g8
a4.
fis8_2)
% bar 10
g,16-5\(
b,16-4
d16-2
g16
g,16-5
c16-3
e16-2
g16
g,16
b,16
d16
g16
g,16
c16
e16
g16
% bar 11
g,4-.\)
g4-.
g,4-.
r4
% bar 12
cis'16->\p-2(
d'16
cis'16
d'16
cis'16
d'16
cis'16
d'16
c'16_2->
d'16
c'16
d'16
c'16
d'16
c'16
d'16)
% bar 13
b16->_3
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
% bar 14
c'16-2\mp
d'16
b16-3
d'16
a16-4
d'16
b16-3
d'16
c'16
d'16
b16
d'16
c'16
d'16
a16
d'16
% bar 15
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
b16
d'16
% bar 16
c'16
d'16
b16
d'16
a16
d'16
b16
d'16
c'16
d'16
b16
d'16
c'16
d'16
a16
d'16
% bar 17
\clef "treble"

r16
b16-5(
d'16-4
g'16-2
b'4)
r16
c'16-5(
e'16-4
g'16-2
c''4)
% bar 18
r16
a16-5(
c'16-4
fis'16-2
a'4)
r16
b16-5(
d'16-4
fis'16-2
b'4)
% bar 19
r16
g16-5(
b16-4
e'16-2
g'4)
r16
a16-5(
c'16-4
e'16-2
a'4)
% bar 20
r16
fis16-5(
a16-4
d'16-2
fis'4)
r16
g16-5(
b16-4
d'16-2
g'4)
% bar 21
\clef "treble"

< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
% bar 22
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
% bar 23
d'16_5
b'16_1
g'16_2
b'16
d'16
b'16
g'16
b'16
d'16
b'16
g'16
b'16
d'16
b'16
g'16
b'16
% bar 24
d'16
c''16
fis'16
c''16
d'16
c''16
fis'16
c''16
d'16
c''16
fis'16
c''16
d'16
c''16
fis'16
c''16
% bar 25
< g'-2 b'-1 >4
r4
r4
< a' c'' d' >4
% bar 26
< g'-2 b'-1 >4
r4
r4
\clef "bass"

< d a c' >4
% bar 27
< g b >4
< g g, >4
< g g, >4
r4
\bar ":|."
% bar 28
\bar ".|:"
< g, g >4
r4
r4
\clef "treble"

< d' a' c'' >4(
% bar 29
< g'-3 bes'-1 >4)
r4
r4
\clef "bass"

< d a c' >4
% bar 30
r16
g16_5(
a16
bes16
c'16
d'16
e'16-3
fis'16
g'4-.\sf)
r4
% bar 31
r16
a16_5(
b16
c'16
d'16
e'16
fis'16-3
gis'16
a'4-.\sf)
r4
% bar 32
< d, d >4
r4
r4
\clef "treble"

< a e' g' >4(
% bar 33
< d'-3 f'-1 >4-.)
r4
r4
\clef "bass"

< a, e g >4(
% bar 34
< d_5 f_4 >4-.)
r4
r16
d'16-3(
f'16
e'16
d'16
c'16-1
b16
a16
% bar 35
gis4-.)\sf
r4
r16
gis16-3(
b16
a16
gis16
f!16-1
e16
d16
% bar 36
c4-.)\sf
r4
\clef "treble"

r16
d'16-5(
a'16-1
g'16
f'16
e'16-1
d'16
c'16
% bar 37
\break
b4-.\sf)
r4
r16
c'16-5(
g'16
f'16
e'16
d'16-1
c'16
b16
% bar 38
a4-.\sf)
r4
r16
b16-5(
f'16
e'16
d'16
c'16-1
b16
a16
% bar 39
\clef "bass"

gis4-.\sf)
r4
r16
a16-3(
c'16-1
b16
a16
g16-1
f16
e16
% bar 40
d2\sf)
< c g bes >2\sf
% bar 41
\clef "treble"

f'8-5(\p
c''8-1
a'8-3
c''8
f'8
c''8
a'8
c''8)
% bar 42
g'8-4
c''8-1
bes'8-2
c''8
f'8-5
c''8-1
a'8-3
c''8
% bar 43
f'8
d''8-1
bes'8-2
d''8
f'8
c''8-1
a'8-3
c''8
% bar 44
e'8-5
c''8-1
g'8-3
c''8
f'8-4
c''8-1
a'8-2
c''8
% bar 45
bes'4
r4
r4
\clef "bass"

< bes f' >4_4-.
% bar 46
< a f' >4-.
r4
r4
< a f' >4_4-.
% bar 47
< g f' >4-.
r4
r4
< g e' >4_4-.
% bar 48
< f f' >4-.
r4
r2
% bar 49
f8-5\(
g16
a16
bes16
c'16
d'16-3
e'16
f'16
e'16
d'16-1
c'16
bes16
a16-1
g16
f16
% bar 50
e8
f16
g16
a16
b16-4
c'16
d'16
e'16
d'16
c'16
b16
a16-1
g16
f16
e16
% bar 51
d8
e16
f16
g16
a16
b16-3
c'16
d'16
c'16
b16
a16
g16-1
f16
e16
d16
% bar 52
c8-5
d16
e16
f16
g16
a16-3
b16
c'16
b16
a16-1
g16
f16
e16-1
d16
c16
% bar 53
\once \set fingeringOrientations = #'(right)

< f-2 a-1 >1\p\)
% bar 54
f4.-3
g8
a4.
fis8-2
% bar 55
g,16-5\(
b,16-4
d16-2
g16
g,16-5
c16-3
e16-2
g16
g,16
b,16
d16
g16
g,16
c16
e16
g16
% bar 56
g,4-.\)
g4-.
g,4-.
r4
% bar 57
\clef "treble"

fis'16->\p-2(
g'16
fis'16
g'16
fis'16
g'16
fis'16
g'16
f'16_2->
g'16
f'16
g'16
f'16
g'16
f'16
g'16)
% bar 58
e'16->_3
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
% bar 59
f'16-2\mp
g'16
e'16-3
g'16
d'16-4
g'16
e'16-3
g'16
f'16
g'16
e'16
g'16
f'16
g'16
d'16
g'16
% bar 60
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
e'16
g'16
% bar 61
f'16
g'16
e'16
g'16
d'16
g'16
e'16
g'16
f'16
g'16
e'16
g'16
f'16
g'16
d'16
g'16
% bar 62
\clef "treble"

r16
e16-5(
g16-4
c'16-2
e'4)
r16
f16-5(
a16-4
c'16-2
f'4)
% bar 63
r16
d16-5(
f16-4
b16-2
d'4)
r16
e16-5(
g16-4
b16-2
e'4)
% bar 64
r16
c'16-5(
e'16-4
a'16-2
c''4)
r16
d'16-5(
f'16-4
a'16-2
d''4)
% bar 65
r16
b16-5(
d'16-4
g'16-2
b'4)
r16
c'16-5(
e'16-4
g'16-2
c''4)
% bar 66
r8
< f' a' >8-.
< f' a' >8-.
< f' a' >8-.
< f' a' >8-.
< f' a' >8-.
< f' a' >8-.
< f' a' >8-.
% bar 67
\clef "bass"

r8
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
% bar 68
g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
g16-5
e'16
c'16-2
e'16
% bar 69
g16
f'16
b16
f'16
g16
f'16
b16
f'16
g16
f'16
b16
f'16
g16
f'16
b16
f'16
% bar 70
< c'-2 e'-1 >4-.
r4
r4
< g d' f' >4(
% bar 71
\override Slur.direction = #-1

< c'_3 e'_1 >4-.)
r4
r4
< g, d f >4(
% bar 72
< c e >4)
< c c' >4-.
< c c, >4
r4
\bar ":|."
% bar 73

}

#(define (significant mus)
   (filter (lambda (m) (or (> (main-len m) 0) (eq? (ly:music-property m 'name) 'GraceMusic)))
           (flat-music mus)))
#(define (signature mus)
   (map music->lily-string (significant mus)))
#(define (check-native label original prepared)
   (let ((a (signature original)) (b (signature prepared)))
     (if (not (equal? a b))
       (begin
         (ly:message "SIGNATURE-LENGTHS ~a ~a ~a" label (length a) (length b))
         (let loop ((x a) (y b) (i 1))
           (if (and (pair? x) (pair? y))
             (if (equal? (car x) (car y)) (loop (cdr x) (cdr y) (+ i 1))
               (ly:message "FIRST-DIFFERENCE ~a ~a original=~a prepared=~a" label i (car x) (car y)))))
         (ly:error "Native round-trip mismatch in ~a" label)))
     (ly:message "ROUND-TRIP-MATCH ~a ~a significant objects" label (length a))))
#(check-native "UPPER" #{ \upperWritten #} #{ \upperMusic #})
#(check-native "LOWER" #{ \lowerWritten #} #{ \lowerMusic #})

\version "2.26.0"
#(set-global-staff-size 25)

\paper {
  indent = 0\mm
  top-margin = 4\mm
  bottom-margin = 4\mm
  left-margin = 4\mm
  right-margin = 4\mm
  paper-width = 150\mm
  paper-height = 75\mm
  print-page-number = ##f
  tagline = ##f
  page-breaking = #ly:one-page-breaking
}

upperCard = {
  \clef treble
  \key c \major
  \time 4/4
  \mark \markup { \box \bold "m. 22" }
  a'2^\finger "(1)"\p)
\acciaccatura b'8-2
c''4-.-3\<
\acciaccatura dis''8-2
e''4-.-3\!
  \acciaccatura { gis''8-2 }
a''4.->
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  \clef "treble"

< c' e' >8_\finger "(53)"-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
< c' e' >8-.
  < c' e' >8_\finger "(53)"-. s1*1/4
  \bar "|."
}

\score {
  \new PianoStaff <<
    \set PianoStaff.connectArpeggios = ##t
    \new Staff = "upper" \upperCard
    \new Staff = "lower" \lowerCard
  >>
  \layout {
    ragged-right = ##f
    system-count = 1
  }
}

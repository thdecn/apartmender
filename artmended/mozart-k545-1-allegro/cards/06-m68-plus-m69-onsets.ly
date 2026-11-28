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
  \mark \markup { \box \bold "m. 68" }
  a''2^\finger "(5)"\p
\acciaccatura gis''8-2
a''4-.
\acciaccatura gis''8
a''4-.
  g''8-1\f
  \bar "|."
}

lowerCard = {
  \clef "treble"
  \key c \major
  \time 4/4
  \clef "bass"

r8
< fis c' ees' >8_\finger "(521)"-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
< fis c' ees' >8-.
  g16-5 s1*1/16
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
